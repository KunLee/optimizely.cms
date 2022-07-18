using Microsoft.Extensions.DependencyInjection;
using NLog;
using NLog.Web;
using webapi.Extensions;

var logger = NLog.LogManager.Setup().LoadConfigurationFromAppSettings().GetCurrentClassLogger();
logger.Debug("init main");

var myAllowSpecificOrigins = "_myAllowSpecificOrigins";

try
{

    var builder = WebApplication.CreateBuilder(args);

    builder.Services.AddCors(options =>
    {
        options.AddPolicy(name: myAllowSpecificOrigins,
                          policy =>
                          {
                              policy.WithOrigins("https://localhost:5000",
                                                  "http://localhost:5000")
                                                        .AllowAnyHeader()
                                                        .AllowAnyMethod(); ;
                          });
    });

    var config = builder.Configuration;
    // Add services to the container.

    builder.Services.AddControllers();
    // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();

    builder.Services.AddExternalServicesConfig(config);

    // NLog: Setup NLog for Dependency injection
    builder.Logging.ClearProviders();
    builder.Host.UseNLog();

    var app = builder.Build();

    // Configure the HTTP request pipeline.
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.ConfigureExceptionHandler(logger);

    app.UseHttpsRedirection();

    // UseCors must be called in the correct order. For more information, see Middleware order.
    // For example, UseCors must be called before UseResponseCaching when using UseResponseCaching.
    app.UseCors(myAllowSpecificOrigins);

    app.UseAuthorization();

    app.MapControllers();

    app.Run();
}
catch (Exception exception)
{
    // NLog: catch setup errors
    logger.Error(exception, "Stopped program because of exception");
    throw;
}
finally
{
    // Ensure to flush and stop internal timers/threads before application-exit (Avoid segmentation fault on Linux)
    NLog.LogManager.Shutdown();
}