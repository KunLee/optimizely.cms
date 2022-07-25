using webapi.Impls;
using webapi.Contracts;

namespace Microsoft.Extensions.DependencyInjection
{
    public static class ExternalConfigServiceCollection
    {
        public static IServiceCollection AddExternalServicesConfig(
             this IServiceCollection services, IConfiguration config)
        {
            var title = config["Urls:RRN"];
            //services.Configure<PositionOptions>(
            //    config.GetSection(PositionOptions.Position));
            //services.Configure<ColorOptions>(
            //    config.GetSection(ColorOptions.Color));
            //services.AddScoped<IExternalService, ExternalService>();
            services.AddHttpClient<IExternalService, ExternalService>();

            return services;
        }
    }
}
