using Microsoft.AspNetCore.Mvc;

namespace Web_SecretRecipe.Controllers
{
    public class EnetsMessageWrapper
    {
        public EnetsMessage msg { get; set; }
        public string ss { get; set; }
    }

    public class EnetsMessage
    {
        public string? netsMid { get; set; }
        public string merchantTxnRef { get; set; }
        public string? netsTxnRef { get; set; }

        // ✅ Change this line
        public decimal? netsAmountDeducted { get; set; }

        public string? netsTxnStatus { get; set; }
        public string? netsTxnMsg { get; set; }        
        
        public string? txnStatus { get; set; }
        public string? netsTxnDtm { get; set; }
        public string? paymentMode { get; set; }
        public string? bankRefCode { get; set; }

        public string? paymentType { get; set; }
        public string? stageRespCode { get; set; }

    }

    public class EnetsRequest
    {
        public string? KeyId { get; set; }
        public string? hmac { get; set; }
        public string? message { get; set; }
    }
   
}