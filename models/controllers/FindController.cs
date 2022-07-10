using Microsoft.AspNetCore.Mvc;

namespace repos.models.controllers
{
    public class FindController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }

        [HttpPost]
        public IActionResult Index(string firstName, string lastName)
        {
            ViewBag.Name = string.Format("Name: {0} {1}", firstName, lastName);
            return View();
        }
    }
}
