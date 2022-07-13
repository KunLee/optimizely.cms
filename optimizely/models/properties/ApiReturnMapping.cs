using EPiServer.Shell.ObjectEditing;
using repos.models.blocks.ElementBlock;
using System.ComponentModel.DataAnnotations;

namespace repos.models.properties
{
    public class ApiReturnMapping
    {
        [Display(Name = "Source Property Name")]
        public virtual string? SourceName { set; get; }

        [Display(
           Name = "Target Property Name",
           GroupName = SystemTabNames.Content,
           Order = 450)]
        public virtual string? TargetName { set; get; }

    }
}
