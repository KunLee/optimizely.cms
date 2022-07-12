using EPiServer.Web.Mvc;
using Microsoft.AspNetCore.Mvc;
using repos.models.pages;

namespace repos.models.controllers
{
    public class HomePageController : PageController<HomePage>
    {
        public IActionResult Index(HomePage currentPage, string firstName, string lastName)
        {

            return View(currentPage);
        }
    }
}
