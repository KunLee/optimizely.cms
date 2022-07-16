using Microsoft.Net.Http.Headers;
using repos.Contracts;

namespace repos.Services
{
    public class ExternalOutputService : IExternalOutputService
    {
        private readonly HttpClient _httpClient;

        public ExternalOutputService(HttpClient httpClient)
        {
            _httpClient = httpClient;

            // using Microsoft.Net.Http.Headers;
            _httpClient.DefaultRequestHeaders.Add(
                HeaderNames.Accept, "application/json");
            _httpClient.DefaultRequestHeaders.Add(
                HeaderNames.UserAgent, "HttpRequestsSample");
        }

        public async Task<object> SendOutput(object data, string uri, string param1 = "", string param2 = "")
        {
            //_httpClient.BaseAddress = new Uri(uri);

            HttpResponseMessage response = await _httpClient.PostAsJsonAsync(uri, data);

            response.EnsureSuccessStatusCode();

            return response.Content;
        }  
    }
}
