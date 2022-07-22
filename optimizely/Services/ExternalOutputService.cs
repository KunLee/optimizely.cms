using Microsoft.Net.Http.Headers;
using Newtonsoft.Json;
using repos.Contracts;
using System.Text;

namespace repos.Services
{
    public class ExternalOutputService : IExternalOutputService
    {
        private readonly HttpClient _httpClient;

        public ExternalOutputService(HttpClient httpClient)
        {
            _httpClient = httpClient;
            // using Microsoft.Net.Http.Headers;
        }

        public async Task<object> SendOutput(object data, string baseAddress, string uri, string token, string param1 = "", string param2 = "")
        {
            //_httpClient.BaseAddress = new Uri(uri);

            var transformedData = JsonConvert.SerializeObject(data);
            var content = new StringContent(transformedData, Encoding.UTF8, "application/json");
            //_httpClient.DefaultRequestHeaders.Add(HeaderNames.Accept, "application/json");
            //_httpClient.DefaultRequestHeaders.Add(HeaderNames.UserAgent, "HttpRequestsSample");
            try {

                HttpResponseMessage response = await _httpClient.PostAsJsonAsync(baseAddress + uri + "token=" + token, content);
                response.EnsureSuccessStatusCode();
                return response.Content;
            }
            catch (Exception ex) {
                throw ex;
            //throw new Exception("Come here!!!");
            }
            

            return null;
        }  
    }
}
