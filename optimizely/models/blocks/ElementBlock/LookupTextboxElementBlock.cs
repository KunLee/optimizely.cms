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
           Name = "Address Field",
           GroupName = SystemTabNames.Content,
           Order = 450)]
        [SelectOne(SelectionFactoryType = typeof(LookupOptionsSelectionFactory))]
        public virtual string? AddressField { get; set; }

        [Display(
           Name = "RRN Field",
           GroupName = SystemTabNames.Content,
           Order = 500)]
        [SelectOne(SelectionFactoryType = typeof(LookupOptionsSelectionFactory))]
        public virtual string? RRNField { get; set; }

        [Display(
           Name = "Return Field",
           GroupName = SystemTabNames.Content,
           Order = 520)]
        [SelectOne(SelectionFactoryType = typeof(LookupOptionsSelectionFactory))]
        public virtual string? ReturnField { get; set; }

        [Display(
           Name = "Coonection Type Field",
           GroupName = SystemTabNames.Content,
           Order = 550)]
        [SelectOne(SelectionFactoryType = typeof(LookupOptionsSelectionFactory))]
        public virtual string? CoonectionTypeField { get; set; }

        [Display(
           Name = "Coonection Phase Field",
           GroupName = SystemTabNames.Content,
           Order = 600)]
        [SelectOne(SelectionFactoryType = typeof(LookupOptionsSelectionFactory))]
        public virtual string? CoonectionPhaseField { get; set; }

        [Display(
           Name = "Export Offtake Agreement Field",
           GroupName = SystemTabNames.Content,
           Order = 650)]
        [SelectOne(SelectionFactoryType = typeof(LookupOptionsSelectionFactory))]
        public virtual string? ExportOfftakeField { get; set; }

        [Display(
          Name = "Emergency Solar Management Field",
          GroupName = SystemTabNames.Content,
          Order = 700)]
        [SelectOne(SelectionFactoryType = typeof(LookupOptionsSelectionFactory))]
        public virtual string? EmergencySolarManagementField { get; set; }
    }

    /// <summary>
    /// The factory used for looping through containing form elements in the Form container.
    /// Then in the settings of LookupTextboxElementBlock where use this list to map the meaningful fields for frontend value settings. 
    /// </summary>
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
                    if (elementBlock is not LookupTextboxElementBlock)
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
