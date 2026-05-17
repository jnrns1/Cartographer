// good/CleanModel.cfc - Triggers: none
// Parameterized access, scoped locals, only private functions, ternary not iif.
component accessors="true" {
    property name="repo";

    private query function activeUsers( required numeric tenantId ) {
        var sql = "SELECT id, email FROM users WHERE tenant_id = :tenant AND active = 1";
        return queryExecute( sql, { tenant = arguments.tenantId } );
    }

    private string function pickLabel( required boolean flag ) {
        return arguments.flag ? "active" : "inactive";
    }
}
