using System.ComponentModel.DataAnnotations;

namespace repos.models.pages
{
    [ContentType(GUID = "32DD2FAA-905F-4F6E-99B6-59DEF7FD2F80", DisplayName ="HomePage")]
    public class HomePage: PageData
    {
        [Display(Order =100, GroupName =SystemTabNames.Content)]
        public virtual ContentArea? Main { set; get; }
    }
}
