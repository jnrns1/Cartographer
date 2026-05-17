// Triggers: none
component {
    private query function byId( required numeric id ) {
        return queryExecute( "SELECT 1", {}, { datasource = "shopDSN" } );
    }
}
