<!--- Triggers: CFML-SEC-001, CFML-MOD-001 --->
<cfcomponent>
  <cffunction name="recent" returntype="query">
    <cfargument name="status" type="string">
    <cfquery name="q" datasource="shopDSN">
      SELECT * FROM orders WHERE status = '#arguments.status#' ORDER BY created DESC
    </cfquery>
    <cfreturn q>
  </cffunction>
  <cffunction name="insertOrder">
    <cfquery datasource="shopDSN">
      INSERT INTO orders (sku, qty) VALUES (1, 2)
    </cfquery>
  </cffunction>
</cfcomponent>
