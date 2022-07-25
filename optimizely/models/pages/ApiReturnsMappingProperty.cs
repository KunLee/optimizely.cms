using EPiServer.PlugIn;
using repos.models.properties;

namespace repos.models.pages
{
    public class ApiReturnsMappingProperty : PageData
    {
        [PropertyDefinitionTypePlugIn]
        public class ApiReturnsMappings : PropertyList<ApiReturnMapping> { }
    }
}
