using EPiServer.Forms.Implementation.Elements;
using EPiServer.Forms.Implementation.Elements.BaseClasses;
using System.ComponentModel.DataAnnotations;

namespace repos.models.blocks.ElementBlock
{
    [ContentType(GUID = "29D86CE3-3874-4E2E-B6DA-BE042FA996FF", GroupName = "ExtendedElements", Order = 2000)]
    public class LookupTextboxElementBlock : InputElementBlockBase
    {
        [Display(Name = "Button Name", GroupName = SystemTabNames.Content, Order = 200)]
        public virtual string? ButtonName { set; get; }
    }
}
