
using EPiServer.Web.Mvc;
using Microsoft.AspNetCore.Mvc;
using repos.models.blocks;
using repos.ViewComponents.ViewModels;

namespace repos.ViewComponents.Optimizely
{
    public class FindRetailerReferenceNumberViewComponent : AsyncBlockComponent<FindRetailerReferenceNumberBlock>
    {
        protected override async Task<IViewComponentResult> InvokeComponentAsync(FindRetailerReferenceNumberBlock currentContent)
        {
            var model = new RetailerReferenceViewModel
            {
                ReferenceNumber = currentContent.ContentEntry.ToPageReference().ProviderName
            };

            return await Task.FromResult(View(currentContent));
        }
    }
}
