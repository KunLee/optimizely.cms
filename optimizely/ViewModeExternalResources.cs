using EPiServer.Forms.Implementation;
using EPiServer.ServiceLocation;

namespace repos
{
    /// <summary>
    /// Register client resources to EPiServer.Forms
    /// </summary>
    [ServiceConfiguration(ServiceType = typeof(IViewModeExternalResources))]
    public class ViewModeExternalResources : IViewModeExternalResources
    {
        public virtual IEnumerable<Tuple<string, string>> Resources
        {
            get
            {
                var arrRes = new List<Tuple<string, string>>();
                arrRes.Add(new Tuple<string, string>("script", "/ClientResources/Scripts/FormScript.js"));
                arrRes.Add(new Tuple<string, string>("css", "/ClientResources/Styles/FormStyle.css"));

                return arrRes;
            }
        }
    }
}
