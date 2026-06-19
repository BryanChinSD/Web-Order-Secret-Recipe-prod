using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Web_SecretRecipe.Controllers;
using Web_SecretRecipe.Models;
using System.Net;
using System.Net.Mail;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using System.Globalization;
using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;


[Route("SR/[action]")]
//[Route("SR")] // Set fixed route prefix
[ApiController]
public class SDController : Controller
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<SDController> _logger;
    private readonly IConfiguration _configuration;
    private readonly string _username;
    private readonly string _password;
    private readonly string _orgId;
    private readonly string _getURL;
    private readonly string _getDomain;
    private readonly string _postURL;
    private readonly string _loginURL;
    private readonly string _signUpURL;
    private readonly string _clinetId;
    private readonly string _ClientSecret;
    private readonly string _redirectUri;
    private readonly string _tokenUrl;
    private readonly string _getCRMURL;
    private readonly string _getPOSURL;
    private readonly string _paymentAPIKey;
    private readonly string _paymentSecret;
    private readonly string _MerchantID;
    private readonly string _netsMidIndicator;
    private readonly string _eNETsDomain;
    private readonly string _eNETsGWDomain;
    private readonly string _b2sTxnEndURL;
    private readonly string _s2sTxnEndURL;
    private readonly string _emailReceiver;
    private readonly string _emailReceiverPW;
    private readonly IWebHostEnvironment _env;
    private readonly IMemoryCache _memoryCache;

    // Inject HttpClient, ILogger, IConfiguration, and IHttpClientFactory via constructor
    public SDController(
        IHttpClientFactory httpClientFactory,  // Add IHttpClientFactory injection
        ILogger<SDController> logger,
        IConfiguration configuration,
        IMemoryCache memoryCache,       // ✅ <== this line
        IWebHostEnvironment env)
    {
        _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory)); // Use injected IHttpClientFactory
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        // Retrieve sensitive information from configuration
        _username = _configuration["ApiCredentials:Username"];
        _password = _configuration["ApiCredentials:Password"];
        _orgId = _configuration["ApiSettings:OrgId"];
        _getURL = _configuration["ApiSettings:GetUrl"];
        _getDomain = _configuration["ApiSettings:GetOBDomain"];
        _postURL = _configuration["ApiSettings:postURL"];
        _loginURL = _configuration["Casdoor:loginURL"];
        _signUpURL = _configuration["Casdoor:signUpURL"];
        _redirectUri = _configuration["Casdoor:RedirectUri"];
        _clinetId = _configuration["Casdoor:ClientId"];
        _ClientSecret = _configuration["Casdoor:ClientSecret"];
        _tokenUrl = _configuration["Casdoor:tokenURL"];
        _getCRMURL = _configuration["Casdoor:GetCRMURL"];
        _getPOSURL = _configuration["Outlet:getSessionURL"];
        _paymentAPIKey = _configuration["payment:APIKey"];
        _paymentSecret = _configuration["payment:SecretKey"];
        _MerchantID = _configuration["payment:MerchantID"];
        _netsMidIndicator = _configuration["payment:netsMidIndicator"];
        _eNETsDomain = _configuration["payment:gwdomain"];
        _eNETsGWDomain = _configuration["payment:gwd2domain"];
        _b2sTxnEndURL = _configuration["payment:b2sTxnEndURL"];
        _s2sTxnEndURL = _configuration["payment:s2sTxnEndURL"];
        _emailReceiver = _configuration["Smtp:ReceiverEmail"];
        _emailReceiverPW = _configuration["Smtp:ReceiverEmailPW"];
        _env = env ?? throw new ArgumentNullException(nameof(env));  // Correct assignment here
        _memoryCache = memoryCache ?? throw new ArgumentNullException(nameof(memoryCache));

    }

    private static readonly HttpClientHandler _handler = new HttpClientHandler
    {
        UseCookies = true,
        CookieContainer = new CookieContainer()
    };
    private static readonly HttpClient _httpClient = new HttpClient(_handler);

    private static readonly SemaphoreSlim _pendingTxnLock = new SemaphoreSlim(1, 1);


    // ✅ Add this helper method to the controller
    private async Task UpdatePendingTransactionAsync(string merchantTxnRef, bool callbackReceived, string queryResult = null)
    {
        await _pendingTxnLock.WaitAsync();
        try
        {
            string pendingFilePath = Path.Combine(_env.ContentRootPath, "Logs", "Payment", "pending_transactions.json");
            List<PendingTransaction> txns;

            if (System.IO.File.Exists(pendingFilePath))
            {
                // ✅ FIX: Simple ReadAllTextAsync is sufficient since semaphore is now truly exclusive
                var json = await System.IO.File.ReadAllTextAsync(pendingFilePath);
                txns = System.Text.Json.JsonSerializer.Deserialize<List<PendingTransaction>>(json)
                       ?? new List<PendingTransaction>();
            }
            else
            {
                txns = new List<PendingTransaction>();
            }

            var txn = txns.FirstOrDefault(t => t.MerchantTxnRef == merchantTxnRef);
            if (txn != null)
            {
                txn.IsCallbackReceived = callbackReceived;
                if (queryResult != null) txn.QueryResult = queryResult;
            }
            else
            {
                txns.Add(new PendingTransaction
                {
                    MerchantTxnRef = merchantTxnRef,
                    CreatedAt = DateTime.UtcNow,
                    IsCallbackReceived = callbackReceived,
                    IsQueried = false,
                    QueryResult = queryResult
                });
            }

            var updatedJson = System.Text.Json.JsonSerializer.Serialize(txns,
                new JsonSerializerOptions { WriteIndented = true });

            // ✅ FIX: Atomic write — temp file swap prevents corruption on crash mid-write
            var tempPath = pendingFilePath + ".tmp";
            await System.IO.File.WriteAllTextAsync(tempPath, updatedJson);
            System.IO.File.Replace(tempPath, pendingFilePath, null);
        }
        finally
        {
            _pendingTxnLock.Release();
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetImageProxy(string imageId)
    {
        if (string.IsNullOrEmpty(imageId))
            return BadRequest("Missing imageId");

        try
        {
            // 1. Create the client from the factory (this handles connection pooling/sessions)
            var client = _httpClientFactory.CreateClient("OpenbravoClient");

            string openbravoImageUrl = $"{_getDomain}/openbravo/utility/ShowImage?id={imageId}";
            _logger.LogInformation($"Requesting image: {openbravoImageUrl}");

            // 2. Use HttpRequestMessage for thread-safety
            var request = new HttpRequestMessage(HttpMethod.Get, openbravoImageUrl);

            // 3. Add headers to the REQUEST, not the client
            var credentials = Convert.ToBase64String(
                Encoding.ASCII.GetBytes($"{_username}:{_password}")
            );
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Add optional headers
            request.Headers.Add("User-Agent", "Mozilla/5.0");
            request.Headers.Accept.ParseAdd("image/webp,image/apng,image/*,*/*;q=0.8");

            // 4. Send the specific request
            var response = await client.SendAsync(request);

            _logger.LogInformation($"Response Status: {response.StatusCode}");

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning($"Image not found: {openbravoImageUrl}, Status: {response.StatusCode}, Error: {errorContent}");
                return NotFound("Image not found");
            }

            var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
            var imageBytes = await response.Content.ReadAsByteArrayAsync();

            return File(imageBytes, contentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error fetching image {imageId}");
            return StatusCode(500, $"Error fetching image: {ex.Message}");
        }
    }

    public class TokenRequest
    {
        public string client_Id { get; set; }
        public string client_Secret { get; set; }
        public string code { get; set; }
    }

    public static class EnetsSignatureHelper
    {
        public static string GenerateSignature(string txnReqJson, string secretKey)
        {
            string concatenated = txnReqJson + secretKey;
            byte[] inputBytes = Encoding.UTF8.GetBytes(concatenated);

            using (var sha256 = SHA256.Create())
            {
                byte[] hash = sha256.ComputeHash(inputBytes);
                return Convert.ToBase64String(hash); // Must be Base64 like eNETS Java example
            }
        }
    }

    [HttpGet]
    public IActionResult GetConfig()
    {
        // Return JSON with camelCase
        return Ok(new { mySpecificSetting = _orgId });
    }


    [HttpPost]
    public async Task<IActionResult> SendFeedback(
   [FromForm] string subject,
   [FromForm] string name,
   [FromForm] string email,
   [FromForm] string? phone,
   [FromForm] string? message,
   [FromForm] IFormFile? attachment)
    {
        try
        {
            // ✅ Changed from _webHostEnvironment to _env
            string templatePath = Path.Combine(_env.ContentRootPath, "EmailTemplateFeedback", "FeedbackTemplate.html");
            string emailTemplate = await System.IO.File.ReadAllTextAsync(templatePath);

            // Replace placeholders
            string emailBody = emailTemplate
                .Replace("{SUBJECT}", WebUtility.HtmlEncode(subject))
                .Replace("{NAME}", WebUtility.HtmlEncode(name))
                .Replace("{EMAIL}", WebUtility.HtmlEncode(email))
                .Replace("{PHONE}", string.IsNullOrEmpty(phone) ? "Not provided" : WebUtility.HtmlEncode(phone))
                .Replace("{MESSAGE}", WebUtility.HtmlEncode(message ?? "No message provided"))
                .Replace("{DATE_TIME}", DateTime.Now.ToString("dddd, MMMM dd, yyyy 'at' hh:mm tt"))
                .Replace("{YEAR}", DateTime.Now.Year.ToString())
                .Replace("{ATTACHMENT_INFO}", attachment != null ? attachment.FileName : "No attachment");

            var mail = new MailMessage
            {
                From = new MailAddress(_emailReceiver, "Secret Recipe Website"),
                Subject = $"🔔 New Feedback - {subject} | Secret Recipe",
                Body = emailBody,
                IsBodyHtml = true
            };

            mail.To.Add(_emailReceiver);

            // VERY IMPORTANT
            mail.ReplyToList.Add(new MailAddress(email, name));

            if (attachment != null && attachment.Length > 0)
            {
                using var ms = new MemoryStream();
                await attachment.CopyToAsync(ms);
                mail.Attachments.Add(new Attachment(new MemoryStream(ms.ToArray()), attachment.FileName));
            }

            using var smtp = new SmtpClient("mail.secretrecipe.com.sg", 587)
            {
                Credentials = new NetworkCredential(
                _emailReceiver,
                _emailReceiverPW
            ),
                EnableSsl = true,
                UseDefaultCredentials = false
            };

            await smtp.SendMailAsync(mail);
            return Ok(new { message = "Feedback sent successfully." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending feedback");
            return StatusCode(500, new
            {
                message = "An error occurred while sending feedback.",
                error = ex.Message
            });
        }
    }


    // [HttpPost]
    // public async Task<IActionResult> SendFeedback(
    //[FromForm] string subject,
    //[FromForm] string name,
    //[FromForm] string email,
    //[FromForm] string? phone,
    //[FromForm] string? message,
    //[FromForm] IFormFile? attachment)
    // {
    //     try
    //     {
    //         // ✅ Changed from _webHostEnvironment to _env
    //         string templatePath = Path.Combine(_env.ContentRootPath, "EmailTemplateFeedback", "FeedbackTemplate.html");
    //         string emailTemplate = await System.IO.File.ReadAllTextAsync(templatePath);

    //         // Replace placeholders
    //         string emailBody = emailTemplate
    //             .Replace("{SUBJECT}", WebUtility.HtmlEncode(subject))
    //             .Replace("{NAME}", WebUtility.HtmlEncode(name))
    //             .Replace("{EMAIL}", WebUtility.HtmlEncode(email))
    //             .Replace("{PHONE}", string.IsNullOrEmpty(phone) ? "Not provided" : WebUtility.HtmlEncode(phone))
    //             .Replace("{MESSAGE}", WebUtility.HtmlEncode(message ?? "No message provided"))
    //             .Replace("{DATE_TIME}", DateTime.Now.ToString("dddd, MMMM dd, yyyy 'at' hh:mm tt"))
    //             .Replace("{YEAR}", DateTime.Now.Year.ToString())
    //             .Replace("{ATTACHMENT_INFO}", attachment != null ? attachment.FileName : "No attachment");

    //         var mail = new MailMessage
    //         {
    //             From = new MailAddress(email, name),
    //             Subject = $"🔔 New Feedback - {subject} | Secret Recipe",
    //             Body = emailBody,
    //             IsBodyHtml = true
    //         };

    //         mail.To.Add(_emailReceiver);

    //         if (attachment != null && attachment.Length > 0)
    //         {
    //             using var ms = new MemoryStream();
    //             await attachment.CopyToAsync(ms);
    //             mail.Attachments.Add(new Attachment(new MemoryStream(ms.ToArray()), attachment.FileName));
    //         }

    //         using var smtp = new SmtpClient("smtp.office365.com", 587)
    //         {
    //             Credentials = new NetworkCredential(_emailReceiver, _emailReceiverPW),
    //             EnableSsl = true
    //         };

    //         await smtp.SendMailAsync(mail);
    //         return Ok(new { message = "Feedback sent successfully." });
    //     }
    //     catch (Exception ex)
    //     {
    //         _logger.LogError(ex, "Error sending feedback");
    //         return StatusCode(500, new
    //         {
    //             message = "An error occurred while sending feedback.",
    //             error = ex.Message
    //         });
    //     }
    // }


    [HttpPost]
    public async Task<IActionResult> PaymentGenerateTxnReq([FromBody] PaymentRequestModel model)
    {
        try
        {
            // ✅ Log request object
            await LogPaymentAsync("PaymentGenerateTxnReq", "REQUEST", JsonConvert.SerializeObject(model));

            if (model == null || model.Amount <= 0 || string.IsNullOrWhiteSpace(model.TxnRef))
            {
                return BadRequest(new { status = "error", message = "Invalid input data." });
            }

            string txnReqRaw = await GenerateTxnReq(model.Amount, model.TxnRef);

            // ✅ Log response from payment API
            await LogPaymentAsync("PaymentGenerateTxnReq", "RESPONSE", txnReqRaw);

            if (txnReqRaw.StartsWith("Error") || txnReqRaw.StartsWith("Exception"))
            {
                return BadRequest(new { status = "error", message = txnReqRaw });
            }

            var txnReqObj = JsonConvert.DeserializeObject<PaymentResponse>(txnReqRaw);

            return Ok(new
            {
                status = "success",
                response = txnReqObj,
                merTxnRef = model.TxnRef
            });
        }
        catch (Exception ex)
        {
            await LogPaymentAsync("PaymentGenerateTxnReq", "EXCEPTION", ex.ToString());
            _logger.LogError(ex, "Exception in PaymentGenerateTxnReq.");

            return BadRequest(new { status = "error", message = ex.Message });
        }
    }

    public async Task<string> GenerateTxnReq(decimal amount, string txnRef)
    {
        try
        {
            string url = $"{_eNETsDomain}/GW2/TxnReqListener";

            int byteLen = Encoding.UTF8.GetByteCount(txnRef);
            _logger.LogInformation("🔍 Using MerchantTxnRef = {txnRef}, ByteLength = {byteLen}", txnRef, byteLen);

            // ---------- Build Payload ----------
            var payload = new
            {
                ss = "1",
                msg = new
                {
                    netsMid = _MerchantID,
                    tid = "",
                    submissionMode = "B",
                    txnAmount = (amount * 100).ToString("F0"),
                    merchantTxnRef = txnRef, // use modified txnRef
                    merchantTxnDtm = DateTime.Now.ToString("yyyyMMdd HH:mm:ss.fff"),
                    paymentType = "SALE",
                    currencyCode = "SGD",
                    paymentMode = "",
                    merchantTimeZone = "+8:00",
                    b2sTxnEndURL = $"{_b2sTxnEndURL}/SR/Return",
                    b2sTxnEndURLParam = "",
                    s2sTxnEndURL = $"{_s2sTxnEndURL}/SR/Callback",
                    s2sTxnEndURLParam = "",
                    clientType = "W",
                    supMsg = "",
                    netsMidIndicator = _netsMidIndicator,
                    language = "en"
                }
            };

            // ---------- Serialize Payload ----------
            var msgObject = payload.msg;
            string msgJson = JsonConvert.SerializeObject(msgObject, new JsonSerializerSettings
            {
                Formatting = Formatting.None,
                NullValueHandling = NullValueHandling.Ignore,
                StringEscapeHandling = StringEscapeHandling.Default
            });
            string payloadJson = JsonConvert.SerializeObject(payload, Formatting.None);

            // ---------- Generate HMAC ----------
            string generatedHmac = GenerateHMAC(msgJson, _paymentSecret);

            var content = new StringContent(payloadJson, Encoding.UTF8, "application/json");

            // ---------- Set Headers ----------
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("KeyId", _paymentAPIKey);
            _httpClient.DefaultRequestHeaders.Add("hmac", generatedHmac);
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

            _logger.LogInformation("Payload: {payloadJson}", payloadJson);
            _logger.LogInformation("HMAC Input (msg only): {msgJson}", msgJson);
            _logger.LogInformation("Generated HMAC: {hmac}", generatedHmac);

            // ---------- Send Request ----------
            var response = await _httpClient.PostAsync(url, content).ConfigureAwait(false);
            var responseContent = await response.Content.ReadAsStringAsync().ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Transaction successfully posted.");
                return responseContent;
            }
            else
            {
                _logger.LogWarning($"Error {response.StatusCode}: {response.ReasonPhrase}. Content: {responseContent}");
                return $"Error {response.StatusCode}: {response.ReasonPhrase}. Content: {responseContent}";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred during transaction request.");
            return $"Exception: {ex.Message}";
        }
    }


    //public async Task<string> GenerateTxnReq(decimal amount, string txnRef)
    //{
    //    try
    //    {
    //        string url = $"{_eNETsDomain}/GW2/TxnReqListener";

    //        // Define API credentials
    //        string KeyId = _paymentAPIKey;
    //        string hmac = _paymentSecret;

    //        // Build payload with dynamic values
    //        var payload = new
    //        {
    //            ss = "1",
    //            msg = new
    //            {
    //                netsMid = _MerchantID,
    //                tid = "",
    //                submissionMode = "B",
    //                txnAmount = (amount * 100).ToString("F0"),
    //                merchantTxnRef = txnRef,
    //                merchantTxnDtm = DateTime.Now.ToString("yyyyMMdd HH:mm:ss.fff"),
    //                paymentType = "SALE",
    //                currencyCode = "SGD",
    //                paymentMode = "",
    //                merchantTimeZone = "+8:00", // use correct zero-padded format
    //                b2sTxnEndURL = $"{_b2sTxnEndURL}/SR/Return",
    //                b2sTxnEndURLParam = "",
    //                s2sTxnEndURL = $"{_s2sTxnEndURL}/SR/Callback",
    //                s2sTxnEndURLParam = "",
    //                clientType = "W",
    //                supMsg = "",
    //                netsMidIndicator = _netsMidIndicator,
    //                language = "en"
    //            }
    //        };


    //        // Serialize payload to JSON
    //        var msgObject = payload.msg;
    //        string msgJson = JsonConvert.SerializeObject(msgObject, new JsonSerializerSettings
    //        {
    //            Formatting = Formatting.None,
    //            NullValueHandling = NullValueHandling.Ignore,
    //            StringEscapeHandling = StringEscapeHandling.Default
    //        });
    //        string payloadJson = JsonConvert.SerializeObject(payload, Formatting.None);
    //        string generatedHmac = GenerateHMAC(msgJson, hmac);

    //        var content = new StringContent(payloadJson, Encoding.UTF8, "application/json");

    //        // Clear any previous headers
    //        _httpClient.DefaultRequestHeaders.Clear();

    //        // Add required headers
    //        _httpClient.DefaultRequestHeaders.Add("KeyId", KeyId);
    //        _httpClient.DefaultRequestHeaders.Add("hmac", generatedHmac);
    //        _logger.LogInformation("payload", payload);
    //        _logger.LogInformation("HMAC Input (msg only): {msgJson}", msgJson);
    //        _logger.LogInformation("Generated HMAC: {hmac}", generatedHmac);

    //        // Add User-Agent header to avoid 463 errors (optional but recommended)
    //        _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");


    //        // Post the request
    //        var response = await _httpClient.PostAsync(url, content).ConfigureAwait(false);

    //        var responseContent = await response.Content.ReadAsStringAsync().ConfigureAwait(false);

    //        if (response.IsSuccessStatusCode)
    //        {
    //            _logger.LogInformation("Transaction successfully posted.");
    //            return responseContent;
    //        }
    //        else
    //        {
    //            _logger.LogWarning($"Error {response.StatusCode}: {response.ReasonPhrase}. Content: {responseContent}");
    //            return $"Error {response.StatusCode}: {response.ReasonPhrase}. Content: {responseContent}";
    //        }
    //    }
    //    catch (Exception ex)
    //    {
    //        _logger.LogError(ex, "Exception occurred during transaction request.");
    //        return $"Exception: {ex.Message}";
    //    }
    //}


    private async Task LogPaymentAsync(string endpoint, string stage, string content)
    {
        try
        {
            var logFolder = Path.Combine(Directory.GetCurrentDirectory(), "Logs", "Payment");

            if (!Directory.Exists(logFolder))
                Directory.CreateDirectory(logFolder);

            var fileName = $"Payment_Init_{DateTime.Now:yyyyMMdd}.log";
            var filePath = Path.Combine(logFolder, fileName);

            var log = new StringBuilder();
            log.AppendLine("========================================");
            log.AppendLine($"Time     : {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            log.AppendLine($"Endpoint : {endpoint}");
            log.AppendLine($"Stage    : {stage}");
            log.AppendLine("Payload  :");
            log.AppendLine(content);
            log.AppendLine();

            await System.IO.File.AppendAllTextAsync(filePath, log.ToString());
        }
        catch
        {
            // never break payment flow
        }
    }

    [HttpPost]
    public async Task<IActionResult> PrepareOnePager()
    {
        try
        {
            using var reader = new StreamReader(Request.Body);
            var body = await reader.ReadToEndAsync();

            // ✅ Log incoming request
            await LogPaymentAsync("PrepareOnePager", "REQUEST", body);

            var jsonObj = JsonConvert.DeserializeObject<JObject>(body);

            var txnRef = jsonObj["merchantTxnRef"]?.ToString();
            var amountStr = jsonObj["txnAmount"]?.ToString();

            if (string.IsNullOrWhiteSpace(txnRef) || !decimal.TryParse(amountStr, out decimal amount) || amount <= 0)
                return Content("<b>Invalid payment request.</b>", "text/html");

            // ✅ Log outgoing to payment API
            await LogPaymentAsync("PrepareOnePager", "OUTGOING_GENERATE_OPTION", jsonObj.ToString());

            string paymentOptionResp = await GeneratePaymentOption(jsonObj);

            // ✅ Log response
            await LogPaymentAsync("PrepareOnePager", "RESPONSE", paymentOptionResp);

            if (paymentOptionResp.StartsWith("Error") || paymentOptionResp.StartsWith("Exception") || paymentOptionResp.StartsWith("<"))
                return Content(paymentOptionResp, "text/html");

            return Content(paymentOptionResp, "text/html");
        }
        catch (Exception ex)
        {
            await LogPaymentAsync("PrepareOnePager", "EXCEPTION", ex.ToString());
            _logger.LogError(ex, "PrepareOnePager failed.");

            return Content($"<b>Internal server error:</b> {ex.Message}", "text/html");
        }
    }



    public async Task<string> GeneratePaymentOption(object fullMsgPayload)
    {
        string endpoint = "GeneratePaymentOption";

        try
        {
            string url = $"{_eNETsDomain}/GW2/prepareOnePager";

            string payloadJson = JsonConvert.SerializeObject(fullMsgPayload, Formatting.Indented);

            var content = new StringContent(payloadJson, Encoding.UTF8, "application/json");
            _httpClient.DefaultRequestHeaders.Clear();

            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0");

            // ✅ Log outgoing request
            await LogPaymentAsync(endpoint, "OUTGOING_REQUEST", payloadJson);

            var response = await _httpClient.PostAsync(url, content);

            var responseContent = await response.Content.ReadAsStringAsync();

            // ✅ Log HTTP status
            await LogPaymentAsync(endpoint, "HTTP_STATUS",
                $"Status: {(int)response.StatusCode} {response.StatusCode}");

            // ✅ Log response body
            await LogPaymentAsync(endpoint, "RESPONSE", responseContent);

            if (response.IsSuccessStatusCode)
            {
                return responseContent;
            }
            else
            {
                return $"Error {response.StatusCode}: {response.ReasonPhrase}. Content: {responseContent}";
            }
        }
        catch (Exception ex)
        {
            // ✅ Log exception
            await LogPaymentAsync(endpoint, "EXCEPTION", ex.ToString());

            return $"Exception: {ex.Message}";
        }
    }

    [HttpPost]
    public async Task<IActionResult> PostDebitInit([FromForm] string txnRand, [FromForm] string paymentMode)
    {
        try
        {
            var jsonObj = new JObject
            {
                ["txnRand"] = txnRand,
                ["paymentMode"] = paymentMode
            };

            // ✅ Log request (form converted to JSON)
            await LogPaymentAsync("PostDebitInit", "REQUEST", jsonObj.ToString());

            string paymentOptionResp = await GenerateDebitPayment(jsonObj);

            // ✅ Log response
            await LogPaymentAsync("PostDebitInit", "RESPONSE", paymentOptionResp);

            if (paymentOptionResp.StartsWith("Error") || paymentOptionResp.StartsWith("Exception") || paymentOptionResp.StartsWith("<"))
                return Content(paymentOptionResp, "text/html");

            return Content(paymentOptionResp, "text/html");
        }
        catch (Exception ex)
        {
            await LogPaymentAsync("PostDebitInit", "EXCEPTION", ex.ToString());
            _logger.LogError(ex, "PostDebitInit failed.");

            return Content($"<b>Internal server error:</b> {ex.Message}", "text/html");
        }
    }

    public async Task<string> GenerateDebitPayment(object fullMsgPayload)
    {
        try
        {
            string url = $"{_eNETsDomain}/GW2/debit/init";

            // Convert object to Dictionary<string, string>
            var dictPayload = JsonConvert.DeserializeObject<Dictionary<string, string>>(
                JsonConvert.SerializeObject(fullMsgPayload)
            );

            var formContent = new FormUrlEncodedContent(dictPayload);

            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0");

            _logger.LogInformation("Sending debit/init payload as x-www-form-urlencoded: {@dictPayload}", dictPayload);

            var response = await _httpClient.PostAsync(url, formContent);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("debit/init success: {responseContent}", responseContent);
                return responseContent;
            }
            else
            {
                return $"Error {response.StatusCode}: {response.ReasonPhrase}. Content: {responseContent}";
            }
        }
        catch (Exception ex)
        {
            return $"Exception: {ex.Message}";
        }
    }


    [HttpPost]
    public async Task<IActionResult> QueryEnetsTxn([FromBody] EnetsMessageWrapper request)
    {
        try
        {
            if (request?.msg?.merchantTxnRef == null)
                return BadRequest(new { status = "error", error = "Missing merchantTxnRef in message" });

            var merchantTxnRef = request.msg.merchantTxnRef;

            var url = $"{_eNETsGWDomain}/GW2/TxnQuery";

            var payload = new
            {
                ss = "1",
                msg = new
                {
                    netsMid = _MerchantID,
                    merchantTxnRef,
                    netsMidIndicator = _netsMidIndicator
                }
            };

            string jsonPayload = JsonConvert.SerializeObject(payload, Formatting.None);
            string hmac = EnetsSignatureHelper.GenerateSignature(jsonPayload, _paymentSecret);

            var httpRequest = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json")
            };
            httpRequest.Headers.Add("keyId", _paymentAPIKey);
            httpRequest.Headers.Add("hmac", hmac);

            var response = await _httpClient.SendAsync(httpRequest);
            var responseBody = await response.Content.ReadAsStringAsync();

            _logger.LogInformation("eNETS response: {0}", responseBody);

            var result = JsonConvert.DeserializeObject<RootPaymentResponse>(responseBody);
            result.rawMsg = responseBody;

            return Ok(new
            {
                ss = "1",
                msg = new
                {
                    netsMid = result.msg.netsMid,
                    merchantTxnRef = result.msg.merchantTxnRef,
                    netsMidIndicator = result.msg.netsMidIndicator,
                    paymentType = result.msg.paymentType,
                    stageRespCode = result.msg.stageRespCode,
                    netsTxnStatus = result.msg.netsTxnStatus
                }
            });

        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "QueryEnetsTxn failed");
            return StatusCode(500, new
            {
                status = "error",
                error = ex.Message
            });
        }
    }




    [HttpPost]
    public async Task<IActionResult> PostCreditInit([FromForm] CreditInitRequest req)
    {
        try
        {
            string paymentOptionResp = await GenerateCreditPayment(req); // ✅ correct
            return Content(paymentOptionResp, "text/html");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "PostCreditInit failed.");
            return Content($"<b>Internal server error:</b> {ex.Message}", "text/html");
        }
    }


    public async Task<string> GenerateCreditPayment(CreditInitRequest fullMsgPayload)
    {
        try
        {
            string url = $"{_eNETsDomain}/GW2/credit/init";

            // Convert object to Dictionary<string, string>
            //var jsonObj = new JObject
            //{
            //    ["txnRand"] = fullMsgPayload.txnRand,
            //    ["paymentMode"] = fullMsgPayload.paymentMode,
            //    ["routeTo"] = fullMsgPayload.routeTo,
            //};

            var dictPayload = new Dictionary<string, string>
            {
                ["txnRand"] = fullMsgPayload.txnRand,
                ["paymentMode"] = fullMsgPayload.paymentMode,
                ["routeTo"] = fullMsgPayload.routeTo
            };

            var formContent = new FormUrlEncodedContent(dictPayload); // ✅ correct

            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0");

            _logger.LogInformation("Sending debit/init payload as x-www-form-urlencoded: {@dictPayload}", dictPayload);

            var response = await _httpClient.PostAsync(url, formContent);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("debit/init success: {responseContent}", responseContent);
                return responseContent;
            }
            else
            {
                return $"Error {response.StatusCode}: {response.ReasonPhrase}. Content: {responseContent}";
            }
        }
        catch (Exception ex)
        {
            return $"Exception: {ex.Message}";
        }
    }

    [HttpPost]
    public async Task<IActionResult> PostPaymentQR([FromBody] QRMsgWrapper req)
    {
        try
        {
            string result = await GeneratePaymentQR(req); // This is a valid JSON string

            _logger.LogInformation("Third-party response: {result}", result);

            // ✅ Return raw JSON string as-is
            return new ContentResult
            {
                Content = result,
                ContentType = "application/json",
                StatusCode = 200
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "PostPaymentQR failed.");

            // Return standard error JSON
            var errorObj = new
            {
                ss = "0",
                msg = new
                {
                    netsTxnStatus = "9",
                    netsTxnMsg = "Internal Server Error",
                    error = ex.Message
                }
            };

            return new JsonResult(errorObj)
            {
                StatusCode = 500
            };
        }
    }



    public async Task<string> GeneratePaymentQR(QRMsgWrapper payload)
    {
        try
        {
            var url = $"{_eNETsDomain}/GW2/getApsQrData";

            var json = JsonConvert.SerializeObject(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0");

            _logger.LogInformation("Sending JSON to getApsQrData: {json}", json);

            var response = await _httpClient.PostAsync(url, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            _logger.LogInformation("getApsQrData response: {responseContent}", responseContent);

            return response.IsSuccessStatusCode
                ? responseContent
                : $"Error {response.StatusCode}: {response.ReasonPhrase}. Content: {responseContent}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GeneratePaymentQR exception");
            return $"Exception: {ex.Message}";
        }
    }


    [HttpPost]
    public async Task<IActionResult> DisplayQRpage([FromQuery] string serviceName)
    {
        try
        {
            using var reader = new StreamReader(Request.Body);
            string qrData = await reader.ReadToEndAsync(); // raw string (qrData)

            var payload = new
            {
                ss = "1",
                msg = new
                {
                    qrData = qrData
                }
            };

            var result = await GenerateQRPage(serviceName, payload);
            return Content(result, "text/html"); // assuming it returns HTML page
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DisplayQRpage failed");
            return StatusCode(500, "Internal server error");
        }
    }
    [HttpGet]
    public IActionResult Payment(bool isSuccess = true, string merchantTxnRef = null)
    {
        try
        {
            string json = isSuccess
                ? TempData["PaymentSuccess"] as string
                : TempData["PaymentFailure"] as string;

            _logger.LogInformation("💳 Payment GET — isSuccess: {IsSuccess}, TxnRef: {Ref}, TempData: {HasJson}",
                isSuccess, merchantTxnRef, string.IsNullOrEmpty(json) ? "EMPTY" : "HAS DATA");

            PaymentSuccessViewModel model = null;

            if (!string.IsNullOrEmpty(json))
            {
                model = JsonConvert.DeserializeObject<PaymentSuccessViewModel>(json);
                _logger.LogInformation("💳 Model from TempData — DocNo: {DocNo}", model?.DocNo ?? "NULL");
            }
            else if (!string.IsNullOrEmpty(merchantTxnRef))
            {
                _memoryCache.TryGetValue($"PAYMENT_RESULT_{merchantTxnRef}", out model);
                _logger.LogInformation("💳 Model from Cache — DocNo: {DocNo}", model?.DocNo ?? "NULL");
            }

            if (model == null)
            {
                _logger.LogWarning("⚠️ Payment GET — model is null, redirecting to Home");
                return RedirectToAction("Index", "Home");
            }

            return View("~/Views/SecretRecipe/Payment.cshtml", model);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Payment GET crashed — isSuccess: {IsSuccess}, TxnRef: {Ref}", isSuccess, merchantTxnRef);
            return StatusCode(500, $"Payment page error: {ex.Message}");
        }
    }


    public async Task<string> GenerateQRPage(string serviceName, object payload)
    {
        try
        {
            var url = $"{_eNETsDomain}/GW2/displayQrPage/?serviceName={serviceName}";

            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0");

            // Serialize full payload for logging only
            var json = JsonConvert.SerializeObject(payload);

            // Extract qrData string from payload
            string qrData;
            try
            {
                var jObj = JObject.FromObject(payload);
                qrData = jObj["msg"]?["qrData"]?.ToString() ?? throw new Exception("qrData missing");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to extract qrData from payload");
                throw;
            }

            // Create content with only qrData string as the body (not JSON)
            var content = new StringContent(qrData, Encoding.UTF8, "application/json");

            _logger.LogInformation("Sending POST to get QR Page for service: {serviceName}, Payload: {payload}", serviceName, json);

            var response = await _httpClient.PostAsync(url, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            _logger.LogInformation("getApsQrData response: {responseContent}", responseContent);

            return response.IsSuccessStatusCode
                ? responseContent
                : $"Error {response.StatusCode}: {response.ReasonPhrase}. Content: {responseContent}";

        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GenerateQRPage exception");
            return $"Exception: {ex.Message}";
        }
    }


    [HttpPost]
    public async Task<IActionResult> DoApsQuery()
    {
        try
        {
            using var reader = new StreamReader(Request.Body);
            string requestBody = await reader.ReadToEndAsync();

            var result = await GenerateDoApsQuery(requestBody);
            return Content(result, "text/html"); // or "application/json" if response is JSON
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DoApsQuery failed.");
            return StatusCode(500, "Internal server error");
        }
    }

    public async Task<string> GenerateDoApsQuery(string payload)
    {
        try
        {
            var url = $"{_eNETsDomain}/GW2/doApsQuery";

            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0");

            var content = new StringContent(payload, Encoding.UTF8, "application/json");

            _logger.LogInformation("Sending APS query: {payload}", payload);

            var response = await _httpClient.PostAsync(url, content, CancellationToken.None);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync();

            _logger.LogInformation("APS query response: {responseContent}", responseContent);

            return responseContent;
        }
        catch (TimeoutException ex)
        {
            _logger.LogError(ex, "Request timed out.");
            return "Request timed out.";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GenerateDoApsQuery exception");
            return $"Exception: {ex.Message}";
        }
    }


    [HttpPost]
    public async Task<IActionResult> DoInternalApsQuery()
    {
        try
        {
            var msgRefId = Request.Headers["msgRefId"].FirstOrDefault();
            if (string.IsNullOrEmpty(msgRefId))
            {
                _logger.LogWarning("Missing msgRefId header");
                return BadRequest("Missing msgRefId header");
            }

            using var reader = new StreamReader(Request.Body);
            var requestBody = await reader.ReadToEndAsync();

            _logger.LogInformation("Received msgRefId: {msgRefId}", msgRefId);
            _logger.LogInformation("Request Body: {requestBody}", requestBody);

            var rawResult = await GenerateDoApsQuery(requestBody);

            // ✅ Load full HTML document
            var doc = new HtmlAgilityPack.HtmlDocument();
            doc.LoadHtml(rawResult);

            // ✅ Remove all <script> tags (to prevent page refresh or auto-submits)
            var scriptNodes = doc.DocumentNode.SelectNodes("//script");
            if (scriptNodes != null)
            {
                foreach (var script in scriptNodes)
                {
                    script.Remove();
                }
            }

            // ✅ Return the cleaned full HTML (not just a form)
            return Content(doc.DocumentNode.OuterHtml, "text/html");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DoInternalApsQuery failed.");
            return StatusCode(500, "Internal server error");
        }
    }






    public async Task<string> GenerateDoInternalApsQuery(string payload)
    {
        try
        {
            var url = $"{_eNETsDomain}/GW2/doInternalApsQuery";

            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0");

            var content = new StringContent(payload, Encoding.UTF8, "application/json");

            _logger.LogInformation("Sending Internal APS query: {payload}", payload);

            var response = await _httpClient.PostAsync(url, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            _logger.LogInformation("APS query response: {responseContent}", responseContent);

            return response.IsSuccessStatusCode
                ? responseContent
                : $"Error {response.StatusCode}: {response.ReasonPhrase}. Content: {responseContent}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GenerateDoApsQuery exception");
            return $"Exception: {ex.Message}";
        }
    }
    private string GenerateHMAC(string message, string secret)
    {
        var keyBytes = Encoding.UTF8.GetBytes(secret);
        var messageBytes = Encoding.UTF8.GetBytes(message);

        using (var hmac = new HMACSHA256(keyBytes))
        {
            var hash = hmac.ComputeHash(messageBytes);
            return Convert.ToBase64String(hash);   // ✅ BASE64
        }
    }


    public class PendingTransaction
    {
        public string MerchantTxnRef { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsCallbackReceived { get; set; }
        public bool IsQueried { get; set; }
        public string QueryResult { get; set; }
    }



    // 🧠 Helper to safely parse DateTime
    private string TryParseDtm(string raw)
    {
        if (DateTime.TryParseExact(raw, "yyyyMMdd HH:mm:ss.fff", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
            return dt.ToString("yyyy-MM-dd HH:mm:ss");
        return raw;
    }

    [HttpPost]
    public async Task<IActionResult> Return([FromForm] EnetsRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.message))
        {
            _logger.LogWarning("Return: request or message is null/empty.");
            return BadRequest("Invalid request.");
        }

        string decodedMessage = WebUtility.UrlDecode(request.message);
        string folderPath = Path.Combine(_env.ContentRootPath, "Logs", "Payment");
        string filePath = Path.Combine(folderPath, $"Payment_{DateTime.Now:yyyy-MM-dd}.txt");

        EnetsMessageWrapper messageObj;
        try
        {
            messageObj = System.Text.Json.JsonSerializer.Deserialize<EnetsMessageWrapper>(
                decodedMessage, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Return: failed to deserialize message.");
            return BadRequest("Invalid message format.");
        }

        if (messageObj?.msg == null)
        {
            _logger.LogWarning("Parsed message object is null.");
            return BadRequest("Parsed message is null.");
        }

        // Log HMAC for audit (does not gate order processing)
        try
        {
            string msg = $@"{{""ss"":""1"",""msg"":{{""netsMid"":""{messageObj.msg.netsMid}"",""merchantTxnRef"":""{messageObj.msg.merchantTxnRef}"",""netsMidIndicator"":""{_netsMidIndicator}""}}}}";
            string expectedSignature = EnetsSignatureHelper.GenerateSignature(msg, _paymentSecret);
            Directory.CreateDirectory(folderPath);
            string keyId = Request.Form.TryGetValue("KeyId", out var k) ? k.ToString() : "(missing)";
            string hmacBase64 = Request.Form.TryGetValue("hmac", out var h) ? h.ToString() : "(missing)";
            bool isSignatureValid = expectedSignature == hmacBase64;

            string logEntry = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}]{Environment.NewLine}" +
                              $"KeyId: {keyId}{Environment.NewLine}" +
                              $"HMAC (Base64 - Received): {hmacBase64}{Environment.NewLine}" +
                              $"HMAC (Base64 - Computed): {expectedSignature}{Environment.NewLine}" +
                              $"Signature Valid: {isSignatureValid}{Environment.NewLine}" +
                              $"Decoded message:{Environment.NewLine}{decodedMessage}{Environment.NewLine}" +
                              $"msg message:{Environment.NewLine}{msg}{Environment.NewLine}";
            System.IO.File.AppendAllText(filePath, logEntry);
            _logger.LogInformation("Decoded (URL-decoded): {Decoded}", decodedMessage);
        }
        catch (Exception ioEx) { _logger.LogError(ioEx, "Failed to write payment log at {Path}", filePath); }

        try
        {
            string merchantTxnRef = messageObj.msg.merchantTxnRef;

            // ✅ FIX: Don't let file bookkeeping failure break Return()
            try { await UpdatePendingTransactionAsync(merchantTxnRef, callbackReceived: true); }
            catch (Exception fileEx)
            {
                _logger.LogError(fileEx, "Return: UpdatePendingTransaction failed for {Ref} — continuing.", merchantTxnRef);
                try { System.IO.File.AppendAllText(filePath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] WARNING: UpdatePendingTransaction failed: {fileEx.Message}\n"); }
                catch { }
            }

            if (messageObj.msg.netsTxnStatus == "0")
            {
                string status = !string.IsNullOrEmpty(messageObj.msg.netsTxnMsg)
                    ? messageObj.msg.netsTxnMsg : "Transaction approved";
                string paymentMode = messageObj.msg.paymentMode == "DD" ? "Direct Debit" : messageObj.msg.paymentMode;
                decimal amountPaid = messageObj.msg.netsAmountDeducted.HasValue
                    ? messageObj.msg.netsAmountDeducted.Value / 100m : 0m;

                // ✅ Order posting is handled exclusively in Callback() (S2S — reliable).
                // Return() only reads the result that Callback() already cached.
                string docNo = null;
                if (_memoryCache.TryGetValue($"PAYMENT_RESULT_{merchantTxnRef}", out PaymentSuccessViewModel cached))
                {
                    docNo = cached?.DocNo;
                    _logger.LogInformation("💳 DocNo from cache for TxnRef: {Ref} — {DocNo}",
                        merchantTxnRef, docNo ?? "not yet available");
                }
                else
                {
                    _logger.LogWarning("⚠️ No cached payment result yet for TxnRef: {Ref} — Callback() may not have arrived.",
                        merchantTxnRef);
                }

                var model = new PaymentSuccessViewModel
                {
                    Status = status,
                    TransactionReference = messageObj.msg.netsTxnRef,
                    OrderReference = merchantTxnRef,
                    DateTime = TryParseDtm(messageObj.msg.netsTxnDtm),
                    AmountPaid = amountPaid,
                    PaymentMode = paymentMode,
                    BankReference = messageObj.msg.bankRefCode,
                    DocNo = docNo
                };

                TempData["PaymentSuccess"] = System.Text.Json.JsonSerializer.Serialize(model);
                _memoryCache.Set($"PAYMENT_RESULT_{merchantTxnRef}", model, TimeSpan.FromMinutes(30));
                _logger.LogInformation("Cached model for {Ref}: {@Model}", merchantTxnRef, model);
                return RedirectToAction("Payment", "SD", new { isSuccess = true, merchantTxnRef });
            }
            else
            {
                string status = !string.IsNullOrEmpty(messageObj.msg.netsTxnMsg)
                    ? messageObj.msg.netsTxnMsg : "Transaction failed";

                var model = new PaymentSuccessViewModel
                {
                    Status = status,
                    TransactionReference = messageObj.msg.netsTxnRef,
                    OrderReference = merchantTxnRef,
                    DateTime = messageObj.msg.netsTxnDtm,
                    AmountPaid = 0,
                    PaymentMode = messageObj.msg.paymentMode,
                    BankReference = messageObj.msg.bankRefCode
                };

                TempData["PaymentFailure"] = System.Text.Json.JsonSerializer.Serialize(model);
                _memoryCache.Set($"PAYMENT_RESULT_{merchantTxnRef}", model, TimeSpan.FromMinutes(10));
                return RedirectToAction("Payment", "SD", new { isSuccess = false, merchantTxnRef });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process Return()");
            try { System.IO.File.AppendAllText(filePath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ERROR: {ex.Message}\n{ex.StackTrace}\n\n"); }
            catch { }
            return BadRequest($"Error: {ex.Message}");
        }
    }


    [HttpPost]
    public async Task<IActionResult> Callback()
    {
        string body = string.Empty;
        string folderPath = Path.Combine(_env.ContentRootPath, "Logs", "Payment");
        string filePath = Path.Combine(folderPath, $"Payment_{DateTime.Now:yyyy-MM-dd}.txt");

        try
        {
            using var reader = new StreamReader(Request.Body);
            body = await reader.ReadToEndAsync();
            Directory.CreateDirectory(folderPath);

            System.IO.File.AppendAllText(filePath,
                $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Callback Received{Environment.NewLine}Raw Body:{Environment.NewLine}{body}{Environment.NewLine}");
            _logger.LogInformation("Callback raw body: {Body}", body);

            using var jsonDoc = JsonDocument.Parse(body);
            var root = jsonDoc.RootElement;
            if (!root.TryGetProperty("msg", out _))
            {
                _logger.LogWarning("Missing 'msg' property in callback.");
                return BadRequest("Invalid message structure.");
            }

            var messageObj = System.Text.Json.JsonSerializer.Deserialize<EnetsMessageWrapper>(
                body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (messageObj?.msg == null || string.IsNullOrEmpty(messageObj.msg.merchantTxnRef))
            {
                _logger.LogWarning("Invalid callback: Missing message body or merchantTxnRef.");
                return BadRequest("Missing transaction data.");
            }

            string merchantTxnRef = messageObj.msg.merchantTxnRef;
            string netsTxnStatus = messageObj.msg.netsTxnStatus;

            var resultObj = new
            {
                Status = netsTxnStatus == "0" ? "success" : "failure",
                Message = messageObj.msg.netsTxnMsg,
                AmountPaid = messageObj.msg.netsAmountDeducted,
                PaymentMode = messageObj.msg.paymentMode,
                BankReference = messageObj.msg.bankRefCode
            };

            // ✅ FIX: Don't let file bookkeeping failure kill the order posting
            try
            {
                await UpdatePendingTransactionAsync(merchantTxnRef, callbackReceived: true,
                    queryResult: System.Text.Json.JsonSerializer.Serialize(resultObj));
            }
            catch (Exception fileEx)
            {
                _logger.LogError(fileEx, "Callback: UpdatePendingTransaction failed for {Ref} — continuing with order post.", merchantTxnRef);
                try { System.IO.File.AppendAllText(filePath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] WARNING: UpdatePendingTransaction failed: {fileEx.Message}\n"); }
                catch { }
                // ✅ Do NOT rethrow — fall through to TriggerPostOrderAsync
            }

            if (netsTxnStatus == "0")
            {
                string paymentMode = messageObj.msg.paymentMode == "DD" ? "Direct Debit" : messageObj.msg.paymentMode;
                string docNo = await TriggerPostOrderAsync(
                    txnRef: merchantTxnRef,
                    paymentMode: paymentMode,
                    netsTxnRef: messageObj.msg.netsTxnRef,
                    paymentStatus: "Y");

                _logger.LogInformation("📦 Callback order post — TxnRef: {Ref}, DocNo: {Doc}",
                    merchantTxnRef, docNo ?? "FAILED");

                var model = new PaymentSuccessViewModel
                {
                    Status = messageObj.msg.netsTxnMsg,
                    TransactionReference = messageObj.msg.netsTxnRef ?? "",
                    OrderReference = merchantTxnRef,
                    DateTime = TryParseDtm(messageObj.msg.netsTxnDtm),
                    AmountPaid = messageObj.msg.netsAmountDeducted.HasValue
                                           ? messageObj.msg.netsAmountDeducted.Value / 100m : 0m,
                    PaymentMode = paymentMode,
                    BankReference = messageObj.msg.bankRefCode,
                    DocNo = docNo
                };
                _memoryCache.Set($"PAYMENT_RESULT_{merchantTxnRef}", model, TimeSpan.FromMinutes(30));
            }
            else
            {
                var model = new PaymentSuccessViewModel
                {
                    Status = messageObj.msg.netsTxnMsg,
                    TransactionReference = messageObj.msg.netsTxnRef ?? "",
                    OrderReference = merchantTxnRef,
                    DateTime = TryParseDtm(messageObj.msg.netsTxnDtm),
                    AmountPaid = 0m,
                    PaymentMode = messageObj.msg.paymentMode,
                    BankReference = messageObj.msg.bankRefCode
                };
                _memoryCache.Set($"PAYMENT_RESULT_{merchantTxnRef}", model, TimeSpan.FromMinutes(10));
            }

            return Ok("ACK");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process callback.");
            try { System.IO.File.AppendAllText(filePath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ERROR: {ex.Message}\n{ex.StackTrace}\n\n"); }
            catch { }
            return BadRequest($"Callback error: {ex.Message}");
        }
    }


    [HttpGet]
    public IActionResult CheckTxnStatus(string merchantTxnRef)
    {
        if (string.IsNullOrEmpty(merchantTxnRef))
            return Json(new { Status = "invalid" });

        string pendingFilePath = Path.Combine(_env.ContentRootPath, "Logs", "Payment", "pending_transactions.json");

        if (!System.IO.File.Exists(pendingFilePath))
            return Json(new { Status = "not_found" });

        var json = System.IO.File.ReadAllText(pendingFilePath);
        var txns = System.Text.Json.JsonSerializer.Deserialize<List<PendingTransaction>>(json);
        var txn = txns?.FirstOrDefault(t => t.MerchantTxnRef == merchantTxnRef);

        if (txn == null)
            return Json(new { Status = "not_found" });

        if (txn.IsCallbackReceived && !string.IsNullOrEmpty(txn.QueryResult))
        {
            try
            {
                var root = JsonDocument.Parse(txn.QueryResult).RootElement;

                var status = root.GetProperty("Status").GetString()?.ToLower();
                bool isSuccess = status == "success";

                var response = new
                {
                    Status = status,
                    msg = new
                    {
                        merchantTxnRef = merchantTxnRef,
                        netsMidIndicator = root.TryGetProperty("netsMidIndicator", out var midInd) ? midInd.GetString() : "",
                        netsTxnStatus = isSuccess ? "0" : "1",
                        netsTxnMsg = root.TryGetProperty("Message", out var msg) ? msg.GetString() : "",
                        netsTxnRef = root.TryGetProperty("netsTxnRef", out var txnRef) ? txnRef.GetString() : "",
                        netsTxnDtm = root.TryGetProperty("netsTxnDtm", out var dtm) ? dtm.GetString() : DateTime.Now.ToString("yyyyMMdd HH:mm:ss.fff"),
                        netsAmountDeducted = root.TryGetProperty("AmountPaid", out var amt) ? amt.GetDecimal() : 0m,
                        paymentMode = root.TryGetProperty("PaymentMode", out var mode) ? mode.GetString() : "",
                        bankRefCode = root.TryGetProperty("BankReference", out var bankRef) ? bankRef.GetString() : ""
                    }
                };

                return Json(response);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse fallback for txnRef={merchantTxnRef}");
                return Json(new { Status = "failure", msg = new { merchantTxnRef } });
            }
        }

        return Json(new { Status = txn.IsCallbackReceived ? "success" : "pending", msg = new { merchantTxnRef } });
    }





    public string Encrypt(object payload, string keyId, string secret)
    {
        var jsonString = JsonConvert.SerializeObject(payload);
        var key = Encoding.UTF8.GetBytes(secret);
        var message = Encoding.UTF8.GetBytes(jsonString);

        using (var hmacsha256 = new HMACSHA256(key))
        {
            var hash = hmacsha256.ComputeHash(message);
            var hmac = Convert.ToBase64String(hash);

            return JsonConvert.SerializeObject(new
            {
                KeyId = keyId,
                hmac = hmac,
                payload = jsonString
            });
        }
    }


    [HttpGet]
    public IActionResult RedirectCasdoor(string actionType)
    {
        string redirectUrl;
        if (actionType == "login")
        {
            // Correcting the string interpolation
            redirectUrl = $"{_loginURL}?client_id={_clinetId}&response_type=code&redirect_uri={_redirectUri}&scope=read&state=casdoor";
        }
        else
        {
            // Redirect to the signup page
            redirectUrl = $"{_signUpURL}?client_id={_clinetId}&response_type=code&redirect_uri={_redirectUri}&scope=read&state=casdoor";
        }

        // Redirect to the generated URL
        return Redirect(redirectUrl);
    }


    public async Task<string> GetAccessTokenAsync(string code)
    {
        var client = _httpClientFactory.CreateClient();

        var payload = new
        {
            grant_type = "authorization_code",
            client_id = _clinetId,
            client_secret = _ClientSecret,
            code = code
        };

        var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(HttpMethod.Post, _tokenUrl)
        {
            Content = content
        };

        try
        {
            var response = await client.SendAsync(request);

            if (response.IsSuccessStatusCode)
            {
                var responseData = await response.Content.ReadAsStringAsync();
                var tokenData = JsonConvert.DeserializeObject<Dictionary<string, string>>(responseData);

                if (tokenData.ContainsKey("access_token"))
                {
                    return tokenData["access_token"];
                }
                else
                {
                    _logger.LogError("Access token not found in the response.");
                    return "Error: Access token not found in response.";
                }
            }
            else
            {
                var errorResponse = await response.Content.ReadAsStringAsync();
                _logger.LogError($"Error: {response.StatusCode}, {errorResponse}");
                return $"Error: {response.StatusCode}, {errorResponse}";
            }
        }
        catch (HttpRequestException e)
        {
            _logger.LogError($"Request failed: {e.Message}");
            return $"Request failed: {e.Message}";
        }
    }

    [HttpPost]
    public async Task<IActionResult> GetAccessToken(string code)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest("Invalid token request. Missing required parameters.");
        }

        try
        {
            _logger.LogInformation("Received token request: clientId={clientId}", _clinetId);
            var result = await GetAccessTokenAsync(code);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while retrieving the access token.");
            return StatusCode(500, "Internal server error");
        }
    }


    private async Task<string> GetOutlets()
    {
        try
        {
            string url = $"{_getURL}/sdcm_v_wa_wo_whs_location?_where=(postalCode='310470'%20OR%20postalCode='238839')&_selectedProperties=id,organization,warehouseOutlet,description,locationAddress,phone,whatsapp,remarks,operatingHours,addressLine1,addressLine2,postalCode,name";
            //string url = $"${_getURL}/sdcm_v_wa_wo_whs_location?_where=(postalCode='310470'%20OR%20postalCode='238839')&_selectedProperties=id,organization,warehouseOutlet,description,locationAddress,phone,whatsapp,remarks,operatingHours,addressLine1,addressLine2,postalCode,name";



            //string url = $"{_getURL}/sdcm_v_wa_wo_whs_location?" +
            //             "_where=organization='" + _orgId + "'" +
            //             "%20AND%20(postalCode='310470'%20OR%20postalCode='238839')" +
            //             "&_selectedProperties=id,organization,warehouseOutlet,description," +
            //             "locationAddress,phone,whatsapp,remarks,operatingHours,addressLine1," +
            //             "addressLine2,postalCode,name";

            // Log the URL for debugging purposes
            _logger.LogInformation($"Requesting URL: {url}");

            // Set the credentials for Basic Authentication
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Make the API request asynchronously
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            // Check if the response is successful
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved outlets.");
                // Consider parsing the response to a JSON object or something structured.
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            // Log the exception
            _logger.LogError(ex, "An exception occurred while fetching outlets.");
            return $"Exception: {ex.Message}";
        }
    }

    private async Task<string> GetCategoriesAsync()
    {
        try
        {
            string url = $"{_getURL}/sdcm_v_wa_wo_menucatg?where=organization='{_orgId}'&_orderBy=description&_selectedProperties=id,organization,productCategory,description,sortSeq,menuCatgImage,image";

            // ✅ Build request message with headers attached to the REQUEST not the client
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved categories.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An exception occurred while fetching categories.");
            return $"Exception: {ex.Message}";
        }
    }


    private async Task<string> GetMenuPackageAsync()
    {
        try
        {
            string url = $"{_getURL}/sdcm_v_wa_wo_menupackage?where=organization='{_orgId}' or organization='0'&_orderBy=menuSequence,menuPackage$_identifier&_selectedProperties=id,organization,menuPackage,packageName,product,quantity,uOM,unitPrice,amount,productCategory,image,image02,incrementby,available,newItem,bestseller,menuSequence";

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved Menu Images.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An exception occurred while fetching categories.");
            return $"Exception: {ex.Message}";
        }
    }


    private async Task<string> GetMenuPackageBestSeller()
    {
        try
        {
            //string url = $"{_getURL}/sdcm_v_wa_wo_menupackage?where=organization='{_orgId}' or organization='0'&_orderBy=menuPackage$_identifier&_selectedProperties=id,organization,menuPackage,product,quantity,uOM,unitPrice,amount,hasCollection,standardPackage,tingkat,productCategory,deliveryMin,dlvyCharges,chargedProduct,ofDays,mealType,brand,selfCollectionAllowed,image,menuCatgImage,image02,menuCatgImage2,incrementby";
            string url = $"{_getURL}/sdcm_v_wa_wo_menupackage?where=organization='{_orgId}' and bestseller='true' &_orderBy=menuSequence&_selectedProperties=id,organization,menuPackage,packageName,product,quantity,uOM,unitPrice,amount,productCategory,image,image02,incrementby,available,newItem,bestseller";

            // Set the credentials for Basic Authentication
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Make the API request asynchronously
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            // Check if the response is successful
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved Menu Images.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            // Log the exception
            _logger.LogError(ex, "An exception occurred while fetching categories.");
            return $"Exception: {ex.Message}";
        }
    }


    private async Task<string> GetMenuPackageSessionAsync(string packageId)
    {
        try
        {
            // Fetch only lightweight properties first
            //string url = $"{_getURL}/sdcm_v_wa_wo_menupackage?_where=productCategory='{packageId}'&_selectedProperties=id,packageName,menuPackage,product,quantity,uOM,unitPrice,amount,productCategory,selfCollectionAllowed,menuCatgImage,description,menuCatgImage2,incrementalValue,isAcceptIcingImage";
            string url = $"{_getURL}/sdcm_v_wa_wo_menupackage?_where=productCategory='{packageId}'&_orderBy=menuSequence&_selectedProperties=id,packageName,menuPackage,packageName,product,quantity,uOM,unitPrice,amount,productCategory,selfCollectionAllowed,image,image02,description,incrementalValue,isAcceptIcingImage,available,newItem,bestseller,menuSequence";

            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            var stopwatch = Stopwatch.StartNew();
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);
            stopwatch.Stop();

            _logger.LogInformation($"API call took {stopwatch.ElapsedMilliseconds} ms");

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved menu package metadata.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An exception occurred while fetching menu package metadata.");
            return $"Exception: {ex.Message}";
        }
    }

    //[HttpGet]
    //public async Task<IActionResult> GetImageProxy(string imageId)
    //{
    //    if (string.IsNullOrEmpty(imageId))
    //        return BadRequest("Missing imageId");

    //    try
    //    {
    //        double nocache = new Random().NextDouble();
    //        string openbravoImageUrl = $"{_getDomain}/openbravo/utility/ShowImage?id={imageId}&nocache={nocache}";

    //        _logger.LogInformation($"Requesting image: {openbravoImageUrl}");

    //        var httpClient = new HttpClient();
    //        var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
    //        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

    //        // Add more headers that browsers typically send
    //        httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0");
    //        httpClient.DefaultRequestHeaders.Add("Accept", "image/webp,image/apng,image/*,*/*;q=0.8");

    //        var response = await httpClient.GetAsync(openbravoImageUrl);

    //        // Log detailed response info
    //        _logger.LogInformation($"Response Status: {response.StatusCode}");
    //        _logger.LogInformation($"Response Headers: {string.Join(", ", response.Headers.Select(h => $"{h.Key}={string.Join(",", h.Value)}"))}");

    //        if (!response.IsSuccessStatusCode)
    //        {
    //            var errorContent = await response.Content.ReadAsStringAsync();
    //            _logger.LogWarning($"Image not found: {openbravoImageUrl}, Status: {response.StatusCode}, Error: {errorContent}");
    //            return NotFound("Image not found");
    //        }

    //        var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
    //        var imageBytes = await response.Content.ReadAsByteArrayAsync();

    //        return File(imageBytes, contentType);
    //    }
    //    catch (Exception ex)
    //    {
    //        _logger.LogError(ex, $"Error fetching image {imageId}");
    //        return StatusCode(500, $"Error fetching image: {ex.Message}");
    //    }
    //}



    //[HttpGet]
    //public async Task<IActionResult> GetImage(string packageId, string imageField = "image")
    //{
    //    try
    //    {
    //        // Reuse the existing method to fetch full package metadata (including image fields)
    //        var json = await GetMenuPackageSessionAsync(packageId);

    //        var obj = JsonConvert.DeserializeObject<dynamic>(json);
    //        var data = obj?.response?.data;

    //        if (data == null || data.Count == 0)
    //            return NotFound("No data found for the provided packageId.");

    //        var imageId = data[0]?[imageField]?.ToString();
    //        if (string.IsNullOrWhiteSpace(imageId))
    //            return NotFound($"Image field '{imageField}' is empty or missing.");

    //        // Download image binary using image ID
    //        using var client = new HttpClient();
    //        var auth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_username}:{_password}"));
    //        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", auth);

    //        var imageUrl = $"{_getURL}/utility/DownloadReport?_entity=ADImage&id={imageId}";
    //        var stream = await client.GetStreamAsync(imageUrl);

    //        return File(stream, "image/jpeg"); // Adjust content-type if not jpeg
    //    }
    //    catch (Exception ex)
    //    {
    //        _logger.LogError(ex, $"Error fetching image for packageId={packageId}, imageField={imageField}");
    //        return StatusCode(500, "Internal server error fetching image.");
    //    }
    //}

    private string ExtractBase64FromJson(string json, string imageField)
    {
        try
        {
            var obj = JsonConvert.DeserializeObject<dynamic>(json);

            if (obj?.response?.data is JArray dataArray && dataArray.Count > 0)
            {
                var item = dataArray[0]; // You could loop or choose differently if needed
                var imageValue = item[imageField];
                return imageValue?.ToString();
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing image JSON.");
            return null;
        }
    }


    private async Task<string> GetMenuPackageById(string menuPackage)
    {
        try
        {
            // Construct the URL with the packageId
            string url = $"{_getURL}/sdcm_v_wa_wo_menupackage?_where=menuPackage='{menuPackage}'&_orderBy=menuSequence&_selectedProperties=id,organization,menuPackage,product,active,quantity,uOM,unitPrice,amount,packageName,hasCollection,standardPackage,tingkat,productCategory,deliveryMin,dlvyCharges,chargedProduct,ofDays,selfCollectionAllowed,image,menuCatgImage,description,image02,menuCatgImage2,incrementalValue,size,showDetails,isAcceptIcingImage";

            // Set the credentials for Basic Authentication
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Make the API request asynchronously
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            // Check if the response is successful
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved Menu Session Package.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            // Log the exception
            _logger.LogError(ex, "An exception occurred while fetching menu session package.");
            return $"Exception: {ex.Message}";
        }
    }

    private async Task<string> GetMenuList(string menuPackage)
    {
        try
        {
            // Construct the URL with the productId (ensure productId is passed correctly)
            string url = $"{_getURL}/sdcm_v_wa_wo_menulistitems?_where=menuPackage='{menuPackage}'&_selectedProperties=id,organization,active,available,requiredOrOptional,uOM,menuCatgGrpLimit,organization$_identifier,menuPackage,menuPackage$_identifier,menuCatgGrpCount,menuCategoryGroup,product,size,amount,unitPrice,isAcceptIcingImage,name,searchKey&orderBy=product$_identifier";
            //string url = $"{_getURL}/sdcm_v_wa_wo_menulistitems?_where=organization='{_orgId}' and menuPackage='{menuPackage}'&_selectedProperties=id,organization,requiredOrOptional,uOM,menuCatgGrpLimit,organization$_identifier,menuPackage,menuPackage$_identifier,menuCatgGrpCount,menuCategoryGroup,product,size&orderBy=product$_identifier";

            // Set the credentials for Basic Authentication
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Make the API request asynchronously
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            // Check if the response is successful
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved GetLiActive.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (HttpRequestException httpEx)
        {
            // Handle HTTP-specific exceptions
            _logger.LogError(httpEx, "An HTTP error occurred while fetching GetLiActive.");
            return $"HTTP Error: {httpEx.Message}";
        }
        catch (Exception ex)
        {
            // Log any other exception
            _logger.LogError(ex, "An exception occurred while fetching GetLiActive.");
            return $"Exception: {ex.Message}";
        }
    }

    private async Task<string> GetMenuListAddOn(string id)
    {
        try
        {
            // Construct the URL with the productId (ensure productId is passed correctly)
            string url = $"{_getURL}/sdcm_v_wa_wo_mlist_addon?_where=menuItemsDishItems='{id}'&_selectedProperties=id,product,description,quantity,uOM,unitPrice,amount";

            // Set the credentials for Basic Authentication
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Make the API request asynchronously
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            // Check if the response is successful
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved GetMenuListAddOn.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (HttpRequestException httpEx)
        {
            // Handle HTTP-specific exceptions
            _logger.LogError(httpEx, "An HTTP error occurred while fetching GetMenuListAddOn.");
            return $"HTTP Error: {httpEx.Message}";
        }
        catch (Exception ex)
        {
            // Log any other exception
            _logger.LogError(ex, "An exception occurred while fetching GetLiActive.");
            return $"Exception: {ex.Message}";
        }
    }

    private async Task<string> GetAllMenupackage()
    {
        try
        {
            string url = $"{_getURL}/sdcm_v_wa_wo_menupackage?where=organization='{_orgId}'&_orderBy=menuSequence&_selectedProperties=id,organization,menuPackage,packageName,product,uOM,unitPrice,amount,productCategory,image,image02,description,incrementalValue,bestseller,available,newItem,menuSequence";

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved Menu Session Package.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An exception occurred while fetching menu session package.");
            return $"Exception: {ex.Message}";
        }
    }
    private async Task<string> GetSelectLift()
    {
        try
        {
            string url = $"{_getURL}/sdcm_v_wa_wo_nonliftcharges?-orderBy=liftLevel&_selectedProperties=id,organization,liftLevel,description,charges,uOM,uOM$_identifier";

            // Set the credentials for Basic Authentication
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Make the API request asynchronously
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            // Check if the response is successful
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved Menu Images.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            // Log the exception
            _logger.LogError(ex, "An exception occurred while fetching categories.");
            return $"Exception: {ex.Message}";
        }
    }
    private async Task<string> locationChargesByPostal(string postalCode)
    {
        try
        {
            string url = $"{_getURL}/sdcm_v_wa_wo_postalcharges?_where=postalCode='{postalCode}'&_selectedProperties=id,deliveryZone,description,pickupMinute,charges,chargedProduct,postalCode,postalArea,uOM,uOM$_identifier";

            // Set the credentials for Basic Authentication
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Make the API request asynchronously
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            // Check if the response is successful
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved Menu Images.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            // Log the exception
            _logger.LogError(ex, "An exception occurred while fetching categories.");
            return $"Exception: {ex.Message}";
        }
    }

    private async Task<string> locationSpecialChargesByPostal(string postalCode)
    {
        try
        {
            var encodedPostalCode = Uri.EscapeDataString(postalCode);
            var prefix = Uri.EscapeDataString(postalCode.Substring(0, 2));

            // First try exact match
            string exactUrl = $"{_getURL}/sdcm_v_wa_wo_area_charge?_where=postalFullCode='{encodedPostalCode}'&_selectedProperties=id,organization,postalFullCode,specificAreas,description,charges,chargedProduct,startingTime,endingTime,uOM,uOM$_identifier";
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            var response = await _httpClient.GetAsync(exactUrl).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                dynamic result = JsonConvert.DeserializeObject(json);

                if (result?.response?.data?.Count > 0)
                {
                    _logger.LogInformation("✅ Exact match found for postal code {PostalCode}", postalCode);
                    return json;
                }
            }

            // Fallback to 2-digit prefix match
            string fallbackUrl = $"{_getURL}/sdcm_v_wa_wo_area_charge?_where=substring(postalFullCode,0,2)='{prefix}'&_selectedProperties=id,organization,postalFullCode,specificAreas,description,charges,chargedProduct,startingTime,endingTime,uOM,uOM$_identifier";
            var fallbackResponse = await _httpClient.GetAsync(fallbackUrl).ConfigureAwait(false);

            if (fallbackResponse.IsSuccessStatusCode)
            {
                var fallbackJson = await fallbackResponse.Content.ReadAsStringAsync().ConfigureAwait(false);
                _logger.LogInformation("⚠️ Fallback match used for postal prefix {Prefix}", prefix);
                return fallbackJson;
            }

            return $"No match found for {postalCode}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Exception while fetching area charges.");
            return $"Exception: {ex.Message}";
        }
    }

    private async Task<string> ChargesByDay()
    {
        try
        {
            string url = $"{_getURL}/sdcm_v_wa_wo_day_charge?_selectedProperties=id,organization,startDay,endDay,isSameDayDelivery,description,charges,chargedProduct,startingTime,endingTime,uOM,uOM$_identifier";

            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                dynamic result = JsonConvert.DeserializeObject(json);

                if (result?.response?.data?.Count > 0)
                {
                    _logger.LogInformation("✅ Same-day delivery charges found.");
                    return json;
                }

                return "No same-day delivery charges found.";
            }

            return $"❌ API call failed: {response.StatusCode}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Exception while fetching same-day delivery charges.");
            return $"Exception: {ex.Message}";
        }
    }

    private async Task<string> calendarBlocking()
    {
        try
        {
            string url = $"{_getURL}/sdcm_v_wa_wo_day_block?_selectedProperties=id,organization,deliveryDate,deliveryDateEnd,description";

            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                dynamic result = JsonConvert.DeserializeObject(json);

                if (result?.response?.data?.Count > 0)
                {
                    _logger.LogInformation("✅ Calendar Blocking found.");
                    return json;
                }

                return "No calendar block found.";
            }

            return $"❌ API call failed: {response.StatusCode}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Exception while fetching same-day delivery charges.");
            return $"Exception: {ex.Message}";
        }
    }

    private async Task<string> GetEventTime()
    {
        try
        {
            string url = $"{_getURL}/sdcm_v_wa_wo_eventtime?where=(organization='{_orgId}' or organization='0')&_selectedProperties=id,sortSeq,eventTime,description,specialNotes,chargedProduct,startingTime,readyTimeCharges,eventTimeCharges,uOM,uOM$_identifier";

            // Set the credentials for Basic Authentication
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Make the API request asynchronously
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            // Check if the response is successful
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved Menu Images.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            // Log the exception
            _logger.LogError(ex, "An exception occurred while fetching categories.");
            return $"Exception: {ex.Message}";
        }
    }
    private async Task<string> GetCollectionTime()
    {
        try
        {
            string url = $"{_getURL}/sdcm_v_wa_wo_collectiontime?_selectedProperties=id,sortSeq,eventTime,description,specialNotes,chargedProduct,startingTime,collectionTimeCharges,uOM,uOM$_identifier&_orderBy=sortSeq";

            // Set the credentials for Basic Authentication
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Make the API request asynchronously
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            // Check if the response is successful
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved Menu Images.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            // Log the exception
            _logger.LogError(ex, "An exception occurred while fetching categories.");
            return $"Exception: {ex.Message}";
        }
    }
    private async Task<string> GetFreeDelivery(string date)
    {
        try
        {
            // Properly encode the date parameter and construct URL
            string url = $"{_getURL}/sdcm_v_wa_wo_public_holiday?_where=deliveryDate='{Uri.EscapeDataString(date)}'and isNoCharge=true&_selectedProperties=id,organization,deliveryDate,name,startingTime,endingTime,description";

            // Set the credentials for Basic Authentication
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Make the API request asynchronously
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            // Check if the response is successful
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved free delivery details.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }

            _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
            return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An exception occurred while fetching categories.");
            return $"Exception: {ex.Message}";
        }
    }
    private async Task<string> GetPublicHolidayDelivery(string date)
    {
        try
        {
            // Properly encode the date parameter and construct URL
            string url = $"{_getURL}/sdcm_v_wa_wo_public_holiday?_where=deliveryDate='{Uri.EscapeDataString(date)}'and isNoCharge=False&_selectedProperties=id,organization,deliveryDate,name,startingTime,endingTime,description,charges,chargedProduct";

            // Set the credentials for Basic Authentication
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Make the API request asynchronously
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            // Check if the response is successful
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved free delivery details.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }

            _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
            return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An exception occurred while fetching categories.");
            return $"Exception: {ex.Message}";
        }
    }
    private async Task<string> GetAllPublicHolidayDelivery()
    {
        try
        {
            // Properly encode the date parameter and construct URL
            string url = $"{_getURL}/sdcm_v_wa_wo_public_holiday?_where=isNoCharge=False&_selectedProperties=id,organization,deliveryDate,name,startingTime,endingTime,description,charges,chargedProduct";

            // Set the credentials for Basic Authentication
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Make the API request asynchronously
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            // Check if the response is successful
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved free delivery details.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }

            _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
            return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An exception occurred while fetching categories.");
            return $"Exception: {ex.Message}";
        }
    }
    private async Task<string> PostCartItem(string xmlData)
    {
        try
        {
            string url = $"{_postURL}.PostSalesOrderCateringWebOrd";

            // Set the credentials for Basic Authentication
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Prepare the XML content to be sent in the POST request
            var content = new StringContent(xmlData, Encoding.UTF8, "application/xml");

            // Make the POST request asynchronously
            var response = await _httpClient.PostAsync(url, content).ConfigureAwait(false);

            // Check if the response is successful
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully Posted.");
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                string errorContent = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}. Content: {errorContent}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}. Content: {errorContent}";
            }
        }
        catch (Exception ex)
        {
            // Log the exception
            _logger.LogError(ex, "An exception occurred while posting the cart item.");
            return $"Exception: {ex.Message}";
        }
    }

    private async Task<string> TriggerPostOrderAsync(
    string txnRef,
    string paymentMode,
    string netsTxnRef,
    string paymentStatus)
    {
        try
        {
            _logger.LogInformation("🔍 TriggerPostOrderAsync — txnRef: {TxnRef}, paymentMode: {Mode}, netsTxnRef: {NetsRef}",
                txnRef, paymentMode, netsTxnRef);

            // ✅ Guard: validate all required payment fields before proceeding
            if (string.IsNullOrWhiteSpace(txnRef))
            {
                _logger.LogError("❌ txnRef is null or empty. Aborting ERP post.");
                return null;
            }
            if (string.IsNullOrWhiteSpace(paymentMode))
            {
                _logger.LogError("❌ paymentMode is null for txnRef: {TxnRef}. Aborting ERP post.", txnRef);
                return null;
            }
            if (string.IsNullOrWhiteSpace(netsTxnRef))
            {
                _logger.LogError("❌ netsTxnRef is null for txnRef: {TxnRef}. Aborting ERP post.", txnRef);
                return null;
            }
            if (string.IsNullOrWhiteSpace(paymentStatus))
            {
                _logger.LogError("❌ paymentStatus is null for txnRef: {TxnRef}. Aborting ERP post.", txnRef);
                return null;
            }

            if (!_memoryCache.TryGetValue($"PENDING_ORDER_XML_{txnRef}", out string xmlData)
                || string.IsNullOrEmpty(xmlData))
            {
                _logger.LogError("❌ No pending order XML found for txnRef: {TxnRef}", txnRef);
                return null;
            }

            // ✅ Inject payment fields
            xmlData = xmlData
                .Replace("<payment_mode>null</payment_mode>", $"<payment_mode>{paymentMode}</payment_mode>")
                .Replace("<payment_mode></payment_mode>", $"<payment_mode>{paymentMode}</payment_mode>")
                .Replace("<payment_refenceno>null</payment_refenceno>", $"<payment_refenceno>{txnRef}</payment_refenceno>")
                .Replace("<payment_refenceno></payment_refenceno>", $"<payment_refenceno>{txnRef}</payment_refenceno>")
                .Replace("<payment_method>null</payment_method>", $"<payment_method>{netsTxnRef}</payment_method>")
                .Replace("<payment_method></payment_method>", $"<payment_method>{netsTxnRef}</payment_method>")
                .Replace("<payment_success>null</payment_success>", $"<payment_success>{paymentStatus}</payment_success>")
                .Replace("<payment_success></payment_success>", $"<payment_success>{paymentStatus}</payment_success>");

            // ✅ Guard: verify no null payment fields remain before sending to ERP
            var remainingNulls = new[]
            {
            "<payment_mode>null</payment_mode>",
            "<payment_refenceno>null</payment_refenceno>",
            "<payment_method>null</payment_method>",
            "<payment_success>null</payment_success>"
        };

            foreach (var nullField in remainingNulls)
            {
                if (xmlData.Contains(nullField))
                {
                    _logger.LogError("❌ XML still contains unresolved null field '{Field}' for txnRef: {TxnRef}. Aborting ERP post.",
                        nullField, txnRef);
                    return null;
                }
            }

            // ✅ Guard: validate XML is parseable before sending
            try
            {
                System.Xml.Linq.XDocument.Parse(xmlData);
            }
            catch (Exception xmlEx)
            {
                _logger.LogError(xmlEx, "❌ XML is malformed for txnRef: {TxnRef}. Aborting ERP post.", txnRef);
                return null;
            }

            _logger.LogInformation("✅ Payment fields injected and validated for txnRef: {TxnRef}", txnRef);

            string prettyXml = TryPrettyXml(xmlData);
            await LogXmlAsync($"REQUEST | TxnRef: {txnRef} | Mode: {paymentMode} | Status: {paymentStatus}", prettyXml);

            string result = await PostCartItem(xmlData);
            _logger.LogInformation("📦 ERP response for txnRef {TxnRef}: {Result}", txnRef, result);

            string prettyResult = TryPrettyXml(result);
            await LogXmlAsync($"RESPONSE | TxnRef: {txnRef}", prettyResult);

            if (result.StartsWith("Error:") || result.StartsWith("Exception:"))
            {
                _logger.LogError("❌ Order post failed for txnRef: {TxnRef}. Result: {Result}", txnRef, result);
                return null;
            }

            // Extract doc number
            string docNo = null;
            try
            {
                var xmlDoc = System.Xml.Linq.XDocument.Parse(result);
                docNo = xmlDoc.Descendants("docNo").FirstOrDefault()?.Value
                     ?? xmlDoc.Descendants("doc_no").FirstOrDefault()?.Value
                     ?? xmlDoc.Descendants("orderNo").FirstOrDefault()?.Value
                     ?? xmlDoc.Descendants("documentNo").FirstOrDefault()?.Value;
                _logger.LogInformation("📄 DocNo extracted: {DocNo}", docNo ?? "not found");
            }
            catch
            {
                try
                {
                    using var jsonDoc = JsonDocument.Parse(result);
                    var root = jsonDoc.RootElement;
                    docNo = root.TryGetProperty("DocNo", out var d1) ? d1.GetString() :
                            root.TryGetProperty("docNo", out var d2) ? d2.GetString() :
                            root.TryGetProperty("doc_no", out var d3) ? d3.GetString() :
                            root.TryGetProperty("orderNo", out var d4) ? d4.GetString() :
                            root.TryGetProperty("ReturnValue", out var d5) ? d5.GetString() : null;
                }
                catch
                {
                    _logger.LogWarning("⚠️ Could not parse doc number. Raw ERP response: {Result}", result);
                }
            }

            _memoryCache.Remove($"PENDING_ORDER_XML_{txnRef}");
            _logger.LogInformation("✅ Order posted successfully for txnRef: {TxnRef}, DocNo: {DocNo}", txnRef, docNo);
            return docNo ?? "";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ TriggerPostOrderAsync failed for txnRef: {TxnRef}", txnRef);
            return null;
        }
    }


    [HttpGet]
    public IActionResult GetOrderDocNo(string merchantTxnRef)
    {
        if (string.IsNullOrEmpty(merchantTxnRef))
            return Json(new { docNo = (string)null, ready = false });

        if (_memoryCache.TryGetValue($"PAYMENT_RESULT_{merchantTxnRef}", out PaymentSuccessViewModel model)
            && !string.IsNullOrEmpty(model?.DocNo))
        {
            return Json(new { docNo = model.DocNo, ready = true });
        }

        return Json(new { docNo = (string)null, ready = false });
    }

    // ✅ Helper to pretty-print XML, falls back to raw string if not valid XML
    private string TryPrettyXml(string content)
    {
        try
        {
            var xmlDoc = System.Xml.Linq.XDocument.Parse(content);
            return xmlDoc.ToString();
        }
        catch
        {
            return content; // not XML (e.g. JSON or plain error string), log as-is
        }
    }

    private async Task<string> UserProfile()
    {
        try
        {
            // Get the ID from the authenticated user's claims
            var memberId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrWhiteSpace(memberId))
            {
                _logger.LogWarning("User ID not found in claims.");
                return "User ID not found.";
            }

            string url = $"{_getCRMURL}/api/v1/members/{memberId}";

            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully retrieved user profile for ID: {id}", memberId);
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning("Error: {StatusCode} - {ReasonPhrase}", response.StatusCode, response.ReasonPhrase);
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An exception occurred while fetching user profile.");
            return $"Exception: {ex.Message}";
        }
    }

    private async Task<string> POSSessionID()
    {
        try
        {
            string url = $"{_getPOSURL}/GetSessionID/01?sessionid=";
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning("Error: {StatusCode} - {ReasonPhrase}", response.StatusCode, response.ReasonPhrase);
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An exception occurred while fetching user profile.");
            return $"Exception: {ex.Message}";
        }
    }
    private async Task<string> POSOutletLocation(string sessionID)
    {
        try
        {
            //var sessionID = User.FindFirst(ClaimTypes.Sid)?.Value;

            string url = $"{_getPOSURL}/GetStore/01?sessionid={sessionID}&storename=%";
            var response = await _httpClient.GetAsync(url).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning("Error: {StatusCode} - {ReasonPhrase}", response.StatusCode, response.ReasonPhrase);
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An exception occurred while fetching user profile.");
            return $"Exception: {ex.Message}";
        }
    }

    private async Task<string> DeleteIcingImage(string imageId)
    {
        try
        {
            string url = $"{_getURL}/ADImage/{imageId}";

            // Setup basic auth header
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            // Send DELETE request
            var response = await _httpClient.DeleteAsync(url).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning("Error: {StatusCode} - {ReasonPhrase}", response.StatusCode, response.ReasonPhrase);
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An exception occurred while deleting image.");
            return $"Exception: {ex.Message}";
        }
    }

    private async Task<string> GetPromotionItem()
    {
        try
        {
            string url = $"{_getURL}/sdcm_v_wa_wo_p_promotion?where=organization='{_orgId}'&_selectedProperties=id,name,description,validTo,image,promotionImage,validTo,creationDate&_orderBy=creationDate%20desc";

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_username}:{_password}"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                var jsonString = await response.Content.ReadAsStringAsync().ConfigureAwait(false);

                // ✅ Keep your existing promotion filtering logic unchanged
                var jsonObject = JObject.Parse(jsonString);
                var promotions = jsonObject["response"]?["data"] as JArray;

                if (promotions != null)
                {
                    var currentDate = DateTime.UtcNow;
                    var validPromotions = new JArray();

                    foreach (var promo in promotions)
                    {
                        var validToStr = promo["validTo"]?.ToString();
                        if (string.IsNullOrEmpty(validToStr)) { validPromotions.Add(promo); continue; }
                        if (DateTime.TryParse(validToStr, out DateTime validTo))
                        {
                            if (validTo >= currentDate) validPromotions.Add(promo);
                        }
                        else { validPromotions.Add(promo); }
                    }

                    jsonObject["response"]["data"] = validPromotions;
                    return jsonObject.ToString();
                }

                return jsonString;
            }
            else
            {
                _logger.LogWarning($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An exception occurred while fetching promotions.");
            return $"Exception: {ex.Message}";
        }
    }

    private async Task<string> UploadImage(ImageUploadModel model)
    {
        try
        {
            string url = $"{_getURL}/ADImage";

            // Wrap model in a data object as expected by external API
            var wrapped = new { data = model };
            var json = System.Text.Json.JsonSerializer.Serialize(wrapped);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(url, content).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            else
            {
                _logger.LogWarning("Error: {StatusCode} - {ReasonPhrase}", response.StatusCode, response.ReasonPhrase);
                return $"Error: {response.StatusCode} - {response.ReasonPhrase}";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An exception occurred while uploading image.");
            return $"Exception: {ex.Message}";
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetPromotion()
    {
        string responseReceived = await GetPromotionItem().ConfigureAwait(false);
        // Return as JSON response
        return Ok(responseReceived);

    }

    [HttpDelete]
    public async Task<IActionResult> DeleteIcingImageByID(string imageId)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(imageId))
            {
                return BadRequest(new { status = "error", message = "Image ID is required." });
            }

            var responseReceived = await DeleteIcingImage(imageId).ConfigureAwait(false);

            if (responseReceived.StartsWith("Error") || responseReceived.StartsWith("Exception"))
            {
                return BadRequest(new { status = "error", message = responseReceived });
            }

            return Ok(new { status = "success", message = responseReceived });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception in DeleteIcingImageByID.");
            return BadRequest(new { status = "error", message = ex.Message });
        }
    }


    private async Task LogXmlAsync(string type, string content)
    {
        try
        {
            var logFolder = Path.Combine(Directory.GetCurrentDirectory(), "Logs", "PostOrder");
            Directory.CreateDirectory(logFolder);

            var fileName = $"{DateTime.Now:yyyyMMdd}_cart.txt";
            var filePath = Path.Combine(logFolder, fileName);

            var sb = new StringBuilder();
            sb.AppendLine("====================================");
            sb.AppendLine($"Time : {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            sb.AppendLine($"Type : {type}");
            sb.AppendLine("------------------------------------");
            sb.AppendLine(content);
            sb.AppendLine();

            await System.IO.File.AppendAllTextAsync(filePath, sb.ToString());
        }
        catch { }
    }

    public class LogXmlRequest
    {
        public string Content { get; set; }
        public string TxnRef { get; set; } // ← add this
    }

    [HttpPost]
    public async Task<IActionResult> LogXmlBeforePayment([FromBody] LogXmlRequest request)
    {
        await LogXmlBeforePayment(request.Content, request.TxnRef); // ← pass txnRef
        return Ok();
    }

    private async Task LogXmlBeforePayment(string content, string txnRef)
    {
        _logger.LogInformation("LogXmlBeforePayment called — TxnRef: {TxnRef}, ContentLength: {Len}",
            txnRef ?? "NULL", content?.Length ?? 0);

        if (!string.IsNullOrEmpty(txnRef))
        {
            _memoryCache.Set($"PENDING_ORDER_XML_{txnRef}", content, TimeSpan.FromHours(2));
            _logger.LogInformation("✅ Cached pending order XML for txnRef: {TxnRef}", txnRef);
        }
        else
        {
            _logger.LogWarning("⚠️ LogXmlBeforePayment called with NULL txnRef — order will NOT be posted!");
        }

        try
        {
            var logFolder = Path.Combine(Directory.GetCurrentDirectory(), "Logs", "PostOrder");
            Directory.CreateDirectory(logFolder);

            var fileName = $"PostOrder_Before_Payment_{DateTime.Now:yyyyMMdd}.txt";
            var filePath = Path.Combine(logFolder, fileName);

            // Pretty-print the XML so it's one tag per line
            string prettyXml = content;
            try
            {
                var xmlDoc = System.Xml.Linq.XDocument.Parse(content);
                prettyXml = xmlDoc.ToString(); // XDocument.ToString() auto-indents
            }
            catch
            {
                // If XML parse fails, fall back to raw content
            }

            var sb = new StringBuilder();
            sb.AppendLine("====================================");
            sb.AppendLine($"TxnRef : {txnRef ?? "NULL"}");
            sb.AppendLine($"Time   : {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            sb.AppendLine("------------------------------------");
            sb.AppendLine(prettyXml); // already line-by-line after XDocument.ToString()
            sb.AppendLine();

            await System.IO.File.AppendAllTextAsync(filePath, sb.ToString());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to write PostOrder log for txnRef: {TxnRef}", txnRef);
        }
    }


    [HttpPost]
    public async Task<IActionResult> SendCartItem()
    {
        try
        {
            using var reader = new StreamReader(Request.Body, Encoding.UTF8);
            var xml = await reader.ReadToEndAsync();

            if (string.IsNullOrWhiteSpace(xml))
            {
                return BadRequest(new { status = "error", message = "Invalid cart item data." });
            }

            // ✅ Log Request XML
            await LogXmlAsync("REQUEST", xml);

            var responseReceived = await PostCartItem(xml).ConfigureAwait(false);

            // ✅ Log Response XML
            await LogXmlAsync("RESPONSE", responseReceived);

            if (responseReceived.StartsWith("Error") || responseReceived.StartsWith("Exception"))
            {
                return BadRequest(new { status = "error", message = responseReceived });
            }

            return Ok(new { status = "success", message = responseReceived });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception in SendCartItem.");

            // ✅ Log Exception
            await LogXmlAsync("EXCEPTION", ex.ToString());

            return BadRequest(new { status = "error", message = ex.Message });
        }
    }



    [HttpPost]
    public async Task<IActionResult> PostCakeWritingImage(ImageUploadModel model)
    {
        try
        {
            if (model == null || string.IsNullOrEmpty(model.BindaryData))
            {
                return BadRequest(new { status = "error", message = "Invalid image data." });
            }


            var responseReceived = await UploadImage(model).ConfigureAwait(false);

            if (responseReceived.StartsWith("Error") || responseReceived.StartsWith("Exception"))
            {
                return BadRequest(new { status = "error", message = responseReceived });
            }

            return Ok(new { status = "success", message = responseReceived });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception in PostCakeWritingImage.");
            return BadRequest(new { status = "error", message = ex.Message });
        }
    }



    [HttpGet]
    public async Task<IActionResult> CalAreaCharges([FromQuery] string postal)
    {
        string responseReceived = await locationChargesByPostal(postal).ConfigureAwait(false);
        // Return as JSON response
        return Ok(responseReceived);
    }

    [HttpGet]
    public async Task<IActionResult> CalAreaSpecialCharges([FromQuery] string postal)
    {
        string responseReceived = await locationSpecialChargesByPostal(postal).ConfigureAwait(false);
        // Return as JSON response
        return Ok(responseReceived);
    }

    [HttpGet]
    public async Task<IActionResult> CalAreaSpecialChargesByDay()
    {
        string responseReceived = await ChargesByDay().ConfigureAwait(false);
        // Return as JSON response
        return Ok(responseReceived);
    }

    [HttpGet]
    public async Task<IActionResult> GetCalendarBlock()
    {
        string responseReceived = await calendarBlocking().ConfigureAwait(false);
        // Return as JSON response
        return Ok(responseReceived);
    }

    [HttpGet]
    public async Task<IActionResult> FreeAreaCharges([FromQuery] string date)
    {
        string responseReceived = await GetFreeDelivery(date).ConfigureAwait(false);
        // Return as JSON response
        return Ok(responseReceived);
    }

    [HttpGet]
    public async Task<IActionResult> PublicHolidayAreaCharges([FromQuery] string date)
    {
        string responseReceived = await GetPublicHolidayDelivery(date).ConfigureAwait(false);
        // Return as JSON response
        return Ok(responseReceived);
    }

    [HttpGet]
    public async Task<IActionResult> AllPublicHolidayAreaCharges()
    {
        string responseReceived = await GetAllPublicHolidayDelivery().ConfigureAwait(false);
        // Return as JSON response
        return Ok(responseReceived);
    }
    [HttpGet]
    public async Task<IActionResult> GetMenuPackage()
    {
        string responseReceived = await GetMenuPackageAsync().ConfigureAwait(false);
        // Return as JSON response
        return Ok(responseReceived);
    }

    [HttpGet]
    public async Task<IActionResult> GetMenuPackageBest()
    {
        string responseReceived = await GetMenuPackageBestSeller().ConfigureAwait(false);
        // Return as JSON response
        return Ok(responseReceived);
    }

    [HttpGet]
    public async Task<IActionResult> Outlets()
    {
        string responseReceived = await GetOutlets().ConfigureAwait(false);
        // If the response contains an error, return it as a BadRequest
        if (responseReceived.StartsWith("Error") || responseReceived.StartsWith("Exception"))
        {
            return BadRequest(responseReceived);
        }

        // Return as JSON response
        return Ok(new { data = responseReceived });
    }

    [HttpGet]
    public async Task<IActionResult> GetMenuCatg()
    {
        string responseReceived = await GetCategoriesAsync().ConfigureAwait(false);
        // Return as JSON response
        return Ok(responseReceived);
    }
    [HttpGet]
    public async Task<IActionResult> GetMenuPackageSession([FromQuery] string packageId)
    {
        string responseReceived = await GetMenuPackageSessionAsync(packageId).ConfigureAwait(false);
        // Return as JSON response
        return Ok(responseReceived);
    }

    [HttpGet]
    public async Task<IActionResult> GetAllMenuPackageSession()
    {
        string responseReceived = await GetAllMenupackage().ConfigureAwait(false);

        // If the response contains an error, return it as a BadRequest
        if (responseReceived.StartsWith("Error") || responseReceived.StartsWith("Exception"))
        {
            return BadRequest(responseReceived);
        }

        // Return as JSON response
        return Ok(new { data = responseReceived });
    }
    [HttpGet]
    public async Task<IActionResult> GetMenuPackageByMenu([FromQuery] string menuPackage)
    {
        string responseReceived = await GetMenuPackageById(menuPackage).ConfigureAwait(false);
        // Return as JSON response
        return Ok(responseReceived);
    }

    [HttpGet]
    public async Task<IActionResult> MenuList([FromQuery] string menuPackage)
    {
        string responseReceived = await GetMenuList(menuPackage).ConfigureAwait(false);

        // If the response contains an error, return it as a BadRequest
        if (responseReceived.StartsWith("Error") || responseReceived.StartsWith("Exception"))
        {
            return BadRequest(responseReceived);
        }

        // Return as JSON response
        return Ok(new { data = responseReceived });
    }

    [HttpGet]
    public async Task<IActionResult> MenuListAddOn([FromQuery] string id)
    {
        string responseReceived = await GetMenuListAddOn(id).ConfigureAwait(false);

        // If the response contains an error, return it as a BadRequest
        if (responseReceived.StartsWith("Error") || responseReceived.StartsWith("Exception"))
        {
            return BadRequest(responseReceived);
        }

        // Return as JSON response
        return Ok(new { data = responseReceived });
    }



    [HttpGet]
    public async Task<IActionResult> GetLift()
    {
        string responseReceived = await GetSelectLift().ConfigureAwait(false);

        // If the response contains an error, return it as a BadRequest
        if (responseReceived.StartsWith("Error") || responseReceived.StartsWith("Exception"))
        {
            return BadRequest(responseReceived);
        }

        // Return as JSON response
        return Ok(new { data = responseReceived });
    }
    [HttpGet]
    public async Task<IActionResult> EventTime()
    {
        string responseReceived = await GetEventTime().ConfigureAwait(false);

        // If the response contains an error, return it as a BadRequest
        if (responseReceived.StartsWith("Error") || responseReceived.StartsWith("Exception"))
        {
            return BadRequest(responseReceived);
        }

        // Return as JSON response
        return Ok(new { data = responseReceived });
    }
    [HttpGet]
    public async Task<IActionResult> CollectionTime()
    {
        string responseReceived = await GetCollectionTime().ConfigureAwait(false);

        // If the response contains an error, return it as a BadRequest
        if (responseReceived.StartsWith("Error") || responseReceived.StartsWith("Exception"))
        {
            return BadRequest(responseReceived);
        }

        // Return as JSON response
        return Ok(new { data = responseReceived });
    }

    [HttpPost]
    public async Task<IActionResult> StoreUserProfileInSession([FromBody] UserProfileModel userProfile)
    {
        // Create user claims
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, userProfile.Id),
            new Claim(ClaimTypes.Name, userProfile.DisplayName),
            new Claim(ClaimTypes.Email, userProfile.Email)
        };

        var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);

        // Sign the user in with a persistent cookie
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(claimsIdentity),
            new AuthenticationProperties
            {
                IsPersistent = true, // Persist even after browser close
                ExpiresUtc = DateTimeOffset.UtcNow.AddDays(7) // Adjust as needed
            });

        return Ok();
    }



    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetUserProfile()
    {
        var result = await UserProfile();
        return Ok(result);
    }


    [HttpPost]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok();
    }

    [HttpGet]
    public async Task<IActionResult> GetPOSSession()
    {
        // Simulating a method that fetches a session ID
        string sessionID = await POSSessionID().ConfigureAwait(false);

        // Create POSModel instance
        var posModel = new POSModel
        {
            SessionID = sessionID
        };

        // Create user claims
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Sid, posModel.SessionID)
        };

        var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);

        // Sign the user in with a persistent cookie
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(claimsIdentity),
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = DateTimeOffset.UtcNow.AddDays(7)
            });

        return Ok(posModel); // Return the POS model if needed
    }

    [HttpGet]
    public async Task<IActionResult> GetPOSOutletLocation(string sessionId)
    {
        string responseReceived = await POSOutletLocation(sessionId).ConfigureAwait(false);

        // If the response contains an error, return it as a BadRequest
        if (responseReceived.StartsWith("Error") || responseReceived.StartsWith("Exception"))
        {
            return BadRequest(responseReceived);
        }

        // Return as JSON response
        return Ok(new { data = responseReceived });
    }

    [HttpPost]
    public IActionResult LogClientError([FromBody] ClientErrorLog errorLog)
    {
        string folderPath = Path.Combine(_env.ContentRootPath, "Logs", "ClientErrors");
        string fileName = $"ClientError_{DateTime.Now:yyyy-MM-dd}.txt";
        string filePath = Path.Combine(folderPath, fileName);

        try
        {
            Directory.CreateDirectory(folderPath);

            // Build detailed log entry
            var logBuilder = new StringBuilder();
            logBuilder.AppendLine("===========================================");
            logBuilder.AppendLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {errorLog.Level ?? "ERROR"}");
            logBuilder.AppendLine($"Client Timestamp: {errorLog.Timestamp}");
            logBuilder.AppendLine($"Function: {errorLog.Function}");
            logBuilder.AppendLine($"Message: {errorLog.Message}");

            if (!string.IsNullOrEmpty(errorLog.Error))
            {
                logBuilder.AppendLine($"Error: {errorLog.Error}");
            }

            if (!string.IsNullOrEmpty(errorLog.Stack))
            {
                logBuilder.AppendLine("Stack Trace:");
                logBuilder.AppendLine(errorLog.Stack);
            }

            if (errorLog.Context != null && errorLog.Context.Count > 0)
            {
                logBuilder.AppendLine("\nContext Details:");

                foreach (var kvp in errorLog.Context)
                {
                    var value = kvp.Value?.ToString() ?? "null";

                    // Truncate very long values but preserve important error messages
                    if (value.Length > 3000 && !kvp.Key.Contains("Error") && !kvp.Key.Contains("Message"))
                    {
                        value = value.Substring(0, 3000) + "... (truncated)";
                    }

                    logBuilder.AppendLine($"  {kvp.Key}: {value}");
                }

                // Extract specific database error details if present
                if (errorLog.Context.ContainsKey("errorType"))
                {
                    logBuilder.AppendLine("\n--- Database Error Summary ---");
                    logBuilder.AppendLine($"Error Type: {errorLog.Context.GetValueOrDefault("errorType")}");
                    logBuilder.AppendLine($"Column: {errorLog.Context.GetValueOrDefault("column")}");
                    logBuilder.AppendLine($"Constraint: {errorLog.Context.GetValueOrDefault("constraint")}");
                    logBuilder.AppendLine($"DB Function: {errorLog.Context.GetValueOrDefault("dbFunction")}");
                    logBuilder.AppendLine($"DB Line: {errorLog.Context.GetValueOrDefault("dbLine")}");
                }
            }

            logBuilder.AppendLine("===========================================");
            logBuilder.AppendLine();

            System.IO.File.AppendAllText(filePath, logBuilder.ToString());

            // Log to application logger based on severity
            if (errorLog.Level == "ERROR")
            {
                _logger.LogError("Client error: {Function} - {Message}",
                    errorLog.Function, errorLog.Message);
            }
            else if (errorLog.Level == "WARNING")
            {
                _logger.LogWarning("Client warning: {Function} - {Message}",
                    errorLog.Function, errorLog.Message);
            }
            else
            {
                _logger.LogInformation("Client log: {Function} - {Message}",
                    errorLog.Function, errorLog.Message);
            }

            return Ok(new { status = "logged" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to log client error");
            return StatusCode(500, new { error = "Failed to log error" });
        }
    }


    // Optional: Add a method to parse and categorize errors for reporting
    private void AnalyzeAndAlertCriticalErrors(ClientErrorLog errorLog)
    {
        if (errorLog.Level != "ERROR") return;

        // Check for critical database errors
        if (errorLog.Context?.ContainsKey("errorType") == true
            && errorLog.Context["errorType"]?.ToString() == "Database Constraint Violation")
        {
            var column = errorLog.Context.GetValueOrDefault("column")?.ToString();

            // Send alert to development team
            _logger.LogCritical(
                "CRITICAL: Database constraint violation detected. Column: {Column}, Function: {Function}",
                column,
                errorLog.Function);

            // You could send email/SMS/Slack notification here
            // await _notificationService.SendAlert($"DB Constraint Error: {column}");
        }

        // Check for repeated errors (could implement rate limiting/alerting)
        if (errorLog.Context?.ContainsKey("statusCode") == true)
        {
            var statusCode = errorLog.Context["statusCode"]?.ToString();
            if (statusCode == "500")
            {
                _logger.LogError("Server 500 error reported from client: {Message}", errorLog.Message);
            }
        }
    }

}