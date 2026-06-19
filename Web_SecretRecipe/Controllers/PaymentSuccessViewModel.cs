using Microsoft.AspNetCore.Mvc;

namespace Web_SecretRecipe.Controllers
{
    public class PaymentSuccessViewModel
    {
        public string? Status { get; set; }
        public string? TransactionReference { get; set; }
        public string? OrderReference { get; set; }
        public string? DateTime { get; set; }
        public decimal? AmountPaid { get; set; }
        public string? PaymentMode { get; set; }
        public string? BankReference { get; set; }
        public string? MerchantTxnRef { get; set; }
        public string? NetsTxnRef { get; set; }
        public string? NetsTxnStatus { get; set; }
        public string? RawMsg { get; set; }
        public string? DocNo { get; set; } // ← nullable
    }
}
