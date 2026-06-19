using Microsoft.AspNetCore.Mvc;

namespace Web_SecretRecipe.Controllers
{
    public class Session : Controller
    {
        [HttpGet]
        public IActionResult KeepAlive()
        {
            // Touch session to reset idle timeout
            HttpContext.Session.SetString("KeepAlive", DateTime.Now.ToString());
            return Ok();
        }
    }
}
