using Microsoft.Net.Http.Headers;
using Newtonsoft.Json;
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
            
        }

        public async Task<object> SendOutput(object data, string uri, string param1 = "", string param2 = "")
        {
            //_httpClient.BaseAddress = new Uri(uri);

            var transformedData = JsonConvert.SerializeObject(data);
            //_httpClient.DefaultRequestHeaders.Add(HeaderNames.Accept, "application/json");
            //_httpClient.DefaultRequestHeaders.Add(HeaderNames.UserAgent, "HttpRequestsSample");
            //try {
                HttpResponseMessage response = await _httpClient.PostAsJsonAsync("asdfasdf", transformedData);
            //}
            //catch (Exception ex) {
            //    throw ex;
            throw new Exception("Come here!!!");
            //}
            response.EnsureSuccessStatusCode();

            return response.Content;
        }  
    }
}
