using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Net.Http.Headers;
using System.Reflection.Metadata;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Xml.Linq;
using static System.Runtime.InteropServices.JavaScript.JSType;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Net.Http;
using Web_SecretRecipe.Models;
using Microsoft.AspNetCore.Components.Server.ProtectedBrowserStorage;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.Extensions.Caching.Memory;
namespace Web_SecretRecipe.Controllers
{
    public class SecretRecipe : Controller
    {
        private readonly ILogger<SecretRecipe> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly string _username;
        private readonly string _password;
        private readonly string _orgId;
        private readonly string _getURL;
        private readonly string _postURL;
        private readonly string _loginURL;
        private readonly string _signUpURL;
        private readonly string _clinetId;
        private readonly string _ClientSecret;
        private readonly string _redirectUri;
        private readonly string _tokenUrl;
        private readonly IMemoryCache _memoryCache;


        public SecretRecipe(ILogger<SecretRecipe> logger, IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _logger = logger;
            _httpClientFactory = httpClientFactory;
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _loginURL = _configuration["Casdoor:loginURL"];
            _signUpURL = _configuration["Casdoor:signUpURL"];
            _redirectUri = _configuration["Casdoor:RedirectUri"];
            _clinetId = _configuration["Casdoor:ClientId"];
            _ClientSecret = _configuration["Casdoor:ClientSecret"];
            _tokenUrl = _configuration["Casdoor:tokenURL"];
        }

        public IActionResult Home()
        {
            return View();
        }

        public IActionResult CakeCategories()
        {
            return View();
        }

        public IActionResult Misc()
        {
            return View();
        }

        public IActionResult Menu()
        {
            return View();
        }
        public IActionResult Menu_BK()
        {
            return View();
        }

        public IActionResult Faq()
        {
            return View();
        }
        public IActionResult Login()
        {
            return View();
        }
        public IActionResult CakeInformation()
        {
            return View();
        }
        public IActionResult Cart()
        {
            return View();
        }
        public IActionResult AllProducts()
        {
            return View();
        }

        public IActionResult Home2()
        {
            return View();
        }
        public IActionResult AboutUs()
        {
            return View();
        }
        public IActionResult Outlets()
        {
            return View();
        }
        public IActionResult Auth()
        {
            return View();
        }
        public IActionResult Feedback()
        {
            return View();
        }
        public IActionResult Terms()
        {
            return View();
        }
        public IActionResult Collections()
        {
            return View();
        }
        public IActionResult Product()
        {
            return View();
        } 
        public IActionResult Coolerbag()
        {
            return View();
        } 
        public IActionResult Products1()
        {
            return View();
        }
        public IActionResult Menupack()
        {
            return View();
        }
        public IActionResult AboutUs_BK2()
        {
            return View();
        }

        public IActionResult Cakes_BK1()
        {
            return View();
        }

        public IActionResult AboutUs_BK()
        {
            return View();
        }

        public IActionResult Shop()
        {
            return View();
        }
        public IActionResult Whatsnew()
        {
            return View();
        }
        public IActionResult JoinOurTeam()
        {
            return View();
        }
        public IActionResult Checkout()
        {
            return View();
        }
        public IActionResult Account()
        {
            return View();
        } 
        public IActionResult callback()
        {
            return View();
        }
        public IActionResult Blog()
        {
            return View();
        }
        //public IActionResult Payment(bool isSuccess = true)
        //{
        //    string key = isSuccess ? "PaymentSuccess" : "PaymentFailure";

        //    if (TempData.ContainsKey(key))
        //    {
        //        var jsonModel = TempData[key]?.ToString();
        //        if (!string.IsNullOrEmpty(jsonModel))
        //        {
        //            var model = JsonConvert.DeserializeObject<PaymentSuccessViewModel>(jsonModel);
        //            return View(model);
        //        }
        //    }

        //    // If TempData missing or corrupt, redirect or show fallback
        //    return View("Error", new ErrorViewModel { Message = "Payment information is missing or expired." });
        //}


        public IActionResult Payment(bool? isSuccess = null, string merchantTxnRef = null)
        {
            PaymentSuccessViewModel model = null;

            if (!string.IsNullOrEmpty(merchantTxnRef))
            {
                if (_memoryCache.TryGetValue<PaymentSuccessViewModel>($"PAYMENT_RESULT_{merchantTxnRef}", out var cachedModel))
                {
                    model = cachedModel;
                }
            }

            if (model == null)
            {
                string key = (isSuccess == true) ? "PaymentSuccess" : "PaymentFailure";

                if (TempData.ContainsKey(key))
                {
                    var jsonModel = TempData[key]?.ToString();
                    if (!string.IsNullOrEmpty(jsonModel))
                    {
                        model = JsonConvert.DeserializeObject<PaymentSuccessViewModel>(jsonModel);
                    }
                }
            }

            if (model == null)
            {
                // Log missing payment info here, then decide what to do
                _logger.LogWarning("Payment information not found for merchantTxnRef={MerchantTxnRef}, isSuccess={IsSuccess}", merchantTxnRef, isSuccess);

                // Option 1: Redirect to a friendly page or checkout
                return RedirectToAction("Checkout", "SecretRecipe");
            }

            return View(model);
        }






        //public IActionResult Payment(string merchantTxnRef, bool? isSuccess = null)
        //{
        //    if (string.IsNullOrEmpty(merchantTxnRef))
        //    {
        //        return View("Error");
        //    }

        //    PaymentSuccessViewModel model = null;

        //    // ✅ 1. Try from MemoryCache
        //    if (_memoryCache.TryGetValue($"PAYMENT_RESULT_{merchantTxnRef}", out model))
        //    {
        //        return View(model);
        //    }

        //    // ✅ 2. Fallback: TempData (only if redirect just happened)
        //    if (TempData["PaymentSuccess"] is string successJson)
        //    {
        //        model = System.Text.Json.JsonSerializer.Deserialize<PaymentSuccessViewModel>(successJson);
        //        return View(model);
        //    }

        //    if (TempData["PaymentFailure"] is string failJson)
        //    {
        //        model = System.Text.Json.JsonSerializer.Deserialize<PaymentSuccessViewModel>(failJson);
        //        return View(model);
        //    }

        //    // ⚠️ 3. Nothing found, maybe still processing — show "Pending" or error
        //    ViewBag.MerchantTxnRef = merchantTxnRef;
        //    ViewBag.Message = "Payment is still being processed. Please refresh or try again later.";
        //    return View("PaymentPending");
        //}


        [Authorize]
        public IActionResult Profile()
        {
            // You now get user info from claims instead of session
            var user = new UserProfileModel
            {
                Id = User.FindFirstValue(ClaimTypes.NameIdentifier),
                DisplayName = User.Identity.Name,
                Email = User.FindFirstValue(ClaimTypes.Email)
            };

            return View(user);
        }
        [Authorize]
        public IActionResult Reward()
        {
            // You now get user info from claims instead of session
            var user = new UserProfileModel
            {
                Id = User.FindFirstValue(ClaimTypes.NameIdentifier),
                DisplayName = User.Identity.Name,
                Email = User.FindFirstValue(ClaimTypes.Email)
            };

            return View(user);
        } 
        [Authorize]
        public IActionResult MyProfile()
        {
            // You now get user info from claims instead of session
            var user = new UserProfileModel
            {
                Id = User.FindFirstValue(ClaimTypes.NameIdentifier),
                DisplayName = User.Identity.Name,
                Email = User.FindFirstValue(ClaimTypes.Email)
            };

            return View(user);
        }


        //    [HttpGet]
        //    public IActionResult RedirectCasdoor(string actionType)
        //    {
        //        string redirectUrl;
        //        if (actionType == "login")
        //        {
        //            // Correcting the string interpolation
        //            redirectUrl = $"{_loginURL}?client_id={_clinetId}&response_type=code&redirect_uri={_redirectUri}&scope=read&state=casdoor";
        //        }
        //        else
        //        {
        //            // Redirect to the signup page
        //            redirectUrl = _signUpURL;
        //        }

        //        // Redirect to the generated URL
        //        return Redirect(redirectUrl);
        //    }


        //    // Helper class for deserializing JSON request body
        //    [HttpGet]
        //    public async Task<IActionResult> Callback([FromQuery] string code, string state)
        //    {
        //        if (string.IsNullOrEmpty(code))
        //        {
        //            _logger.LogError("Authorization code not found in the callback.");
        //            return BadRequest(new { Error = "Authorization code is missing." });
        //        }

        //        _logger.LogInformation("Received authorization code: {Code}, State: {State}",code, state);

        //        // Exchange the authorization code for an access token
        //        var tokenResponse = await GetAccessTokenAsync(code);

        //        if (!string.IsNullOrEmpty(tokenResponse.Error))
        //        {
        //            _logger.LogError("Failed to retrieve access token: {Error}", tokenResponse.Error);
        //            return StatusCode(500, new { Error = $"Failed to retrieve access token: {tokenResponse.Error}" });
        //        }

        //        _logger.LogInformation("Successfully retrieved access token.");
        //        return Ok(new { AccessToken = tokenResponse.AccessToken });
        //    }

        //    private async Task<TokenResponse> GetAccessTokenAsync(string code)
        //    {
        //        var client = _httpClientFactory.CreateClient();
        //        var payload = new
        //        {
        //            grant_type = "authorization_code",
        //            client_id = _clinetId,
        //            client_secret = _ClientSecret,
        //            code = code,
        //            redirect_uri = _redirectUri // Ensure this matches the registered redirect URI
        //        };

        //        var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
        //        var request = new HttpRequestMessage(HttpMethod.Post, _tokenUrl)
        //        {
        //            Content = content
        //        };

        //        try
        //        {
        //            var response = await client.SendAsync(request);

        //            if (response.IsSuccessStatusCode)
        //            {
        //                var responseData = await response.Content.ReadAsStringAsync();
        //                var tokenData = JsonConvert.DeserializeObject<Dictionary<string, string>>(responseData);

        //                if (tokenData.ContainsKey("access_token"))
        //                {
        //                    return new TokenResponse { AccessToken = tokenData["access_token"] };
        //                }
        //                else
        //                {
        //                    _logger.LogError("Access token not found in the response.");
        //                    return new TokenResponse { Error = "Access token not found in response." };
        //                }
        //            }
        //            else
        //            {
        //                var errorResponse = await response.Content.ReadAsStringAsync();
        //                _logger.LogError("Error: {StatusCode}, {ErrorResponse}", response.StatusCode, errorResponse);
        //                return new TokenResponse { Error = $"Error: {response.StatusCode}, {errorResponse}" };
        //            }
        //        }
        //        catch (HttpRequestException e)
        //        {
        //            _logger.LogError("Request failed: {Message}", e.Message);
        //            return new TokenResponse { Error = $"Request failed: {e.Message}" };
        //        }
        //    }


        //    [HttpGet]
        //    public IActionResult GetAuthorizationUrl(string actionType)
        //    {
        //        string authorizationUrl;
        //        if (actionType == "login")
        //        {
        //            authorizationUrl = $"{_loginURL}?client_id={_clinetId}&response_type=code&redirect_uri={_redirectUri}&scope=read&state=casdoor";
        //        }
        //        else
        //        {
        //            authorizationUrl = _signUpURL;
        //        }

        //        return Ok(new { url = authorizationUrl });
        //    }
    }



    //public class TokenResponse
    //{
    //    public string AccessToken { get; set; } // Optional, if you still want to keep it
    //    public Dictionary<string, string> FullResponse { get; set; } // Stores the entire response
    //    public string Error { get; set; } // For error handling
    //}


}
