using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using System.ComponentModel.DataAnnotations;
using Web_SecretRecipe.Controllers;

namespace Web_SecretRecipe.Models
{
    public class CreditInitRequest
    {
        public string txnRand { get; set; }
        public string paymentMode { get; set; }
        public string routeTo { get; set; }

        // All remaining fields are optional — allow null or empty string
        public string? selectedTokenService { get; set; }
        public string? tsTxnReqFlag { get; set; }
        public string? expiryMonth { get; set; }
        public string? expiryYear { get; set; }
        public string? tsStatus { get; set; }
        public string? tsIntMsg { get; set; }
        public string? tsMerchMsg { get; set; }
        public string? cardHolderName { get; set; }
        public string? consumerEmail { get; set; }
        public string? maskPan { get; set; }
        public string? TxnRef { get; set; }
    }


    public class PaymentRequestModel
    {
        [JsonProperty("txnAmount")]
        public decimal Amount { get; set; }

        [JsonProperty("merchantTxnRef")]
        public string TxnRef { get; set; }
    }


    public class PaymentOptionsViewModel
    {
        public string TxnRef { get; set; } = string.Empty;
        public List<PaymentOption> Options { get; set; } = new();
    }
    public class PaymentOption
    {
        public string Name { get; set; }
        public string Code { get; set; }
        public string IconUrl { get; set; }
    }
    public class PaymentResponse
    {
        public string ss { get; set; }
        //public string txnToken { get; set; }
        public Msg msg { get; set; }


    }
    public class RootPaymentResponse
    {
        public string status { get; set; }
        public PaymentResponse response { get; set; }

        public Msg msg { get; set; }
        public string rawMsg { get; set; }

    }
    public class Msg
    {
        public string netsMid { get; set; }
        public string submissionMode { get; set; }
        public string txnAmount { get; set; }
        public string merchantTxnRef { get; set; }
        public string merchantTxnDtm { get; set; }
        public string netsMidIndicator { get; set; }
        public string paymentType { get; set; }
        public string currencyCode { get; set; }
        public string netsTxnRef { get; set; }
        public string netsTxnDtm { get; set; }
        public string merchantTimeZone { get; set; }
        public string b2sTxnEndURL { get; set; }
        public string s2sTxnEndURL { get; set; }
        public string clientType { get; set; }
        public string netsTxnStatus { get; set; }
        public string netsTxnMsg { get; set; }
        public string stageRespCode { get; set; }
        public List<string> merchantSvcList { get; set; }
        public List<PaymtSvcInfo> paymtSvcInfoList { get; set; }
        public string txnRand { get; set; }
        public string merchantGrpName { get; set; }
        public string language { get; set; }
        public string rsaModulus { get; set; }
        public string rsaExponent { get; set; }
        public string ss { get; set; }
        public string apiKey { get; set; }
        public string actionCode { get; set; }
        public string msgActionCode { get; set; }

        //public string txnToken { get; set; }
    }
    public class QRMsgWrapper
    {
        public string ss { get; set; }
        public QRMsg msg { get; set; }
    }
    public class QRMsg
    {
        public string? netsMid { get; set; }
        public string? txnRand { get; set; }
        public string? merchantTxnRef { get; set; }
        public string? netsTxnRef { get; set; }
        public string? netsMidIndicator { get; set; }
        public string? txnAmount { get; set; }
        public string? paymentMode { get; set; }

        // Add other fields as needed
    }


    public class PaymtSvcInfo
    {
        public string paymtSvcId { get; set; }
        public string netsMid { get; set; }
        public string tsReqFlag { get; set; }
    }


    public class TxnQueryRequestModel
    {
        public string NetsTxnRef { get; set; }
        public string MerchantTxnRef { get; set; }
    }
    public class TxnQueryResponseModel
    {
        public string ss { get; set; }
        public TxnQueryMsg msg { get; set; }

        public TxnQueryMsg TxnMsgs { get; set; }

        public string rawMsg { get; set; }


    }
    public class TxnQueryRequestPayload
    {
        public string ss { get; set; } = "1";
        public TxnQueryRequestMsg msg { get; set; }
    }

    public class TxnQueryRequestMsg
    {
        public string netsMid { get; set; }
        public string merchantTxnRef { get; set; }
        public string netsMidIndicator { get; set; } = "U"; // Default for merchant
        public string? stageRespCode { get; set; } // Optional
    }

    public class TxnQueryMsg
    {
        public string txnStatus { get; set; }
        public string netsTxnRef { get; set; }
        public string merchantTxnRef { get; set; }
        public string stageRespCode { get; set; }
        public string actionCode { get; set; }
        public string netsTxnMsg { get; set; }
        public string rawMsg { get; set; } // ✅ ADD THIS
    }


    public class TxnMsg
    {
        public string merchantTxnRef { get; set; }
        public string netsTxnStatus { get; set; }  // <-- match actual key
        public string netsTxnMsg { get; set; }
        public string rawMsg { get; set; }
        public string stageRespCode { get; set; }
        public string actionCode { get; set; }
        public string hmac { get; set; }
        public string allDistraFlag { get; set; }
    }

    public class ClientErrorLog
    {
        public string Timestamp { get; set; }
        public string Level { get; set; }
        public string Function { get; set; }
        public string Message { get; set; }
        public string? Error { get; set; }
        public string? Stack { get; set; }
        public Dictionary<string, object> Context { get; set; }
    }
}
