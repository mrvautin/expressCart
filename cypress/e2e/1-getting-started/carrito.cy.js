/* eslint-disable no-undef */
/* eslint-disable spaced-comment */
/* eslint-disable extra-rules/no-commented-out-code */
/* eslint-disable quotes */
describe("Cantidad de productos del carrito", () => {
  beforeEach(() => {
    cy.visit("http://localhost:1111/");
  });
  it("Prueba con entrada aceptable", () => {
    // 2,t,$3,"vqcio"
    cy.get("p.text-center > .btn").click();
    cy.get("#product_quantity").clear();
    cy.get("#product_quantity").type("2");
    cy.get(".btnAddToCart > .btn").click();
    //cy.get(".navbar-nav > :nth-child(3) > .btn"); // carrito
    cy.get("#notify_message").should("have.text", "Cart successfully updated"); // mensaje de confirmacion "Cart sucessfully updated"
  });
  it("Prueba con letra", () => {
    // 2,t,$3,"vqcio"
    cy.get("p.text-center > .btn").click();
    cy.get("#product_quantity").clear();
    cy.get("#product_quantity").type("e");
    cy.get(".btnAddToCart > .btn").click();
    cy.get("#notify_message").should("have.text", "Cannot update cart"); // mensaje de confirmacion "Cart sucessfully updated"
  });
  it("Prueba con caracter especial", () => {
    // 2,t,$3,"vqcio"
    cy.get("p.text-center > .btn").click();
    cy.get("#product_quantity").clear();
    cy.get("#product_quantity").type("$3");
    cy.get(".btnAddToCart > .btn").click();
    cy.get("#notify_message").should("have.text", "Cannot update cart"); // mensaje de confirmacion "Cart sucessfully updated"
  });
  it("Prueba sin entrada", () => {
    // 2,t,$3,"vqcio"
    cy.get("p.text-center > .btn").click();
    cy.get("#product_quantity").clear();

    cy.get(".btnAddToCart > .btn").click();

    cy.get("#notify_message").should("have.text", "Please select a quantity"); // mensaje de confirmacion "Cart sucessfully updated"
  });
});
