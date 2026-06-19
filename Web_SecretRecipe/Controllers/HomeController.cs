using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Web_SecretRecipe.Models;

namespace Web_SecretRecipe.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;
        private readonly IConfiguration _configuration;
        private readonly CasdoorSettings _casdoorSettings;

        public HomeController(ILogger<HomeController> logger, IConfiguration configuration, IOptions<CasdoorSettings> casdoorSettings)
        {
            _logger = logger;
            _configuration = configuration;
            _casdoorSettings = casdoorSettings.Value;

        }

        public IActionResult Index()
        {
            var model = new CasdoorSettings
            {
                ClientId = "d9787d63068e3257cffe",
                ClientSecret = "fdba0f713913e7bd5230dfe59a479ef99fdc79ce"
            };
            // Get the ClientId from appsettings.json
            var clientId = _configuration["Casdoor:ClientId"];
            var ClientSecret = _configuration["Casdoor:ClientSecret"];

            // Pass the ClientId to the view
            ViewData["ClientId"] = clientId;
            ViewData["ClientSecret"] = ClientSecret;

            return View();
        }

        //public IActionResult Index()
        //{
        //    return View();
        //}

        //public IActionResult Privacy()
        //{
        //    return View();
        //}

        //[ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        //public IActionResult Error()
        //{
        //    return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        //}
    }
}
