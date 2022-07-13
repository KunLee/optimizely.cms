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
            var client = new HttpClient();
            HttpResponseMessage response = await client.GetAsync(_config["Urls:RRN"]);
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadAsStringAsync();
            return result;
        }
    }
}
