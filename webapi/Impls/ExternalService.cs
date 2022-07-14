using webapi.Interfaces;

namespace webapi.Impls
{
    public class ExternalService : IExternalService
    {
        private readonly IConfiguration _config;
        public ExternalService(IConfiguration config)
        {
            _config = config;
        }
        async Task<object> IExternalService.GetBasicInfo(string RRN)
        {
            //https://uat.westernpower.transactcentral.com/forms/servlet/FormDynamicDataServlet?RetailerReferenceNum=0304894853&sfmRequestKey=5ffc3e98265021855af149255659fead&sfmServiceName=EGA_Application_RRN_Validation
            var client = new HttpClient();
            var requestUrl = $"{_config["Urls:RRN:Url"]}?RetailerReferenceNum={RRN}&sfmRequestKey={_config["Urls:RRN:sfmRequestKey"]}&sfmServiceName={_config["Urls:RRN:sfmServiceName"]}";
            HttpResponseMessage response = await client.GetAsync(requestUrl);
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadAsStringAsync();
            return result;
        }
    }
}
