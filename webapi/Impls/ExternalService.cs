using webapi.Contracts;

namespace webapi.Impls
{
    public class ExternalService : IExternalService
    {
        private readonly IConfiguration _config;
        private readonly HttpClient _httpClient;
        public ExternalService(IConfiguration config, HttpClient httpClient)
        {
            _config = config;
            _httpClient = httpClient;
        }
        async Task<object> IExternalService.GetBasicInfo(string RRN)
        {
            //https://uat.westernpower.transactcentral.com/forms/servlet/FormDynamicDataServlet?RetailerReferenceNum=0304894853&sfmRequestKey=5ffc3e98265021855af149255659fead&sfmServiceName=EGA_Application_RRN_Validation
            //var client = new HttpClient();
            var requestUrl = $"{_config["Urls:RRN:Url"]}?RetailerReferenceNum={RRN}&sfmRequestKey={_config["Urls:RRN:sfmRequestKey"]}&sfmServiceName={_config["Urls:RRN:sfmServiceName"]}";


            //requestUrl = "https://uat.westernpower.transactcentral.com/forms/servlet/FormDynamicDataServlet?RetailerReferenceNum=EGA18072022DM1&sfmRequestKey=5ffc3e98265021855af149255659fead&sfmServiceName=EGA_Application_RRN_Validation";

            HttpResponseMessage response = await _httpClient.GetAsync(requestUrl);
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadAsStringAsync();

            //throw new Exception("Help me Help me Help me");
            return result;
        }
    }
}
