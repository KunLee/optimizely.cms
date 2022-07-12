using System.ComponentModel.DataAnnotations;

namespace repos.models.properties
{
    public class ApiReturnMapping
    {
        [Display(Name = "Source Property Name")]
        public virtual string? SourceName { set; get; }

        [Display(Name = "Target Property Name")]
        public virtual string? TargetName { set; get; }

    }
}
