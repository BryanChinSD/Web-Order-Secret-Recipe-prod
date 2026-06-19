namespace Web_SecretRecipe.Models
{
    public class CasdoorSettings
    {
        public string Username { get; set; }
        public string Password { get; set; }
        public string OrgId { get; set; }
        public string ClientId { get; set; }
        public string ClientSecret { get; set; }
        public string RedirectUri { get; set; }
        public string LoginUrl { get; set; }
        public string SignUpUrl { get; set; }
        public string TokenUrl { get; set; }
    }


    public class ApiSettings
    {
        public string OrgId { get; set; }
        public string GetUrl { get; set; }
        public string PostUrl { get; set; }
    }

}
