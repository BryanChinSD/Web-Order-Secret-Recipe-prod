using System.Text.Json.Serialization;

namespace Web_SecretRecipe.Models
{
    public class UserProfileModel
    {
        public string? Id { get; set; }
        public string? DisplayName { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? DOB { get; set; }
        public string? Gender { get; set; }
        public string? JWT { get; set; }
        public Preferences Preferences { get; set; } = new Preferences();
        public string? ProfileImageURL { get; set; }


    }

    public class Preferences
    {
        public bool SmsNotifications { get; set; }
        public bool EmailNotifications { get; set; }
    }
     public class POSModel
     {
         public string SessionID { get; set; }
     }

    public class ImageUploadModel
    {
        [JsonPropertyName("entityName")]
        public string EntityName { get; set; }

        [JsonPropertyName("organization")]
        public string Organization { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("bindaryData")]   // 👈 JSON name (lowercase b)
        public string BindaryData { get; set; } // 👈 C# name (capital B)
    }

    public class ImageUploadWrapper
    {
        public ImageUploadModel Data { get; set; }
    }

}
