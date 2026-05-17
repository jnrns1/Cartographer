// Triggers: CFML-AI-001, CFML-AI-002, CFML-TEST-001
component persistent="true" table="orders" accessors="true" {
    property name="id" type="numeric";
    property name="total" type="numeric";

    public numeric function calculateTotal( required array lines ) {
        var sum = 0;
        for ( var line in arguments.lines ) {
            sum += line.amount;
        }
        return sum;
    }

    public string function label() {
        return "order-" & variables.id;
    }
}
