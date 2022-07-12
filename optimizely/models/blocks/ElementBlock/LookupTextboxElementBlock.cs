using EPiServer.Cms.Shell.Extensions;
using EPiServer.Cms.Shell.UI.ObjectEditing.EditorDescriptors;
using EPiServer.Forms.Core;
using EPiServer.Forms.Implementation.Elements.BaseClasses;
using EPiServer.ServiceLocation;
using EPiServer.Shell.ObjectEditing;
using repos.models.properties;
using System.ComponentModel.DataAnnotations;

namespace repos.models.blocks.ElementBlock
{
    [ContentType(GUID = "29D86CE3-3874-4E2E-B6DA-BE042FA996FF", GroupName = "ExtendedElements", Order = 2000)]
    public class LookupTextboxElementBlock : InputElementBlockBase
    {
        [Display(Name = "Button Name", GroupName = SystemTabNames.Content, Order = 200)]
        public virtual string? ButtonName { set; get; }

        [Display(Name = "Lookup Url", GroupName = SystemTabNames.Content, Order = 300)]
        public virtual string? LookupUrl { set; get; }

        [Display(Name = "List of ApiReturnMappings", GroupName = SystemTabNames.Content, Order = 400)]
        [EditorDescriptor(EditorDescriptorType = typeof(CollectionEditorDescriptor<ApiReturnMapping>))]
        public virtual IList<ApiReturnMapping>? ApiReturnMappings { get; set; }

        [Display(
           Name = "Address field",
           GroupName = SystemTabNames.Content,
           Order = 450)]
        [CultureSpecific]
        [SelectOne(SelectionFactoryType = typeof(LookupOptionsSelectionFactory))]
        public virtual string? AddressField { get; set; }

        [Display(
           Name = "RRN field",
           GroupName = SystemTabNames.Content,
           Order = 550)]
        [SelectOne(SelectionFactoryType = typeof(LookupOptionsSelectionFactory))]
        public virtual string? RRNField { get; set; }
    }

    public class LookupOptionsSelectionFactory : ISelectionFactory
    {
        public IEnumerable<ISelectItem> GetSelections(ExtendedMetadata metadata)
        {
            var contentLoader = ServiceLocator.Current.GetInstance<IContentLoader>();
            var formContainer = ((LookupTextboxElementBlock)metadata.FindOwnerContent()).FindOwnerForm();
            var items = new List<ISelectItem>
            {
                new SelectItem { Text = "Empty", Value = "" }
            };

            if (formContainer?.ElementsArea?.FilteredItems != null && formContainer.ElementsArea.FilteredItems.Any())
            {
                foreach (var item in formContainer.ElementsArea.FilteredItems)
                {
                    var elementBlock = contentLoader.Get<ElementBlockBase>(item.ContentLink);
                    if (!(elementBlock is LookupTextboxElementBlock))
                    {
                        items.Add(new SelectItem
                        {
                            Text = ((IContent)elementBlock).Name,
                            Value = elementBlock.FormElement.Guid
                        });
                    }
                }
            }

            return items;
        }
    }
}
