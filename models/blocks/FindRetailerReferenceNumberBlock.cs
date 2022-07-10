using System.ComponentModel.DataAnnotations;

namespace repos.models.blocks
{
    [ContentType(DisplayName = "Find RRN", 
                GUID = "FAF32937-CC3E-4207-8052-E174B5DB4ECF",
                GroupName = "Common")]
    public class FindRetailerReferenceNumberBlock : BlockData
    {
        [Display(Name = "Content Area", GroupName = SystemTabNames.Content, Order = 100 )]
        public virtual ContentReference? ContentEntry { set; get; }

        [Display(Name = "Content Submit", GroupName = SystemTabNames.Content, Order = 200)]
        public virtual ContentReference? ContentSubmit { set; get; }
    }
}
