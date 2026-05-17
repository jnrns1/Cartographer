// Triggers: CFML-AI-001, CFML-TEST-001
component accessors="true" singleton {
    public array function listActive( required numeric tenantId ) {
        return queryExecute(
            "SELECT id, email FROM users WHERE tenant_id = :t AND active = 1",
            { t = arguments.tenantId }
        ).reduce( (acc, row) => acc.append(row), [] );
    }
    public struct function findById( required numeric id ) {
        return queryExecute(
            "SELECT * FROM users WHERE id = :id", { id = arguments.id }
        );
    }
}
