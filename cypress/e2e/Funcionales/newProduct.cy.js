/* eslint-disable extra-rules/no-commented-out-code */
/* eslint-disable quotes */
/* eslint-disable spaced-comment */
/* eslint-disable no-undef */
describe("createOrder", () => {
  beforeEach("newProduct", () => {
    cy.visit("http://localhost:1111/admin");
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(4) > .sidebar-link-addon").click({ force: true });
    //cy.get('.float-right > .btn').click()
  });

  it("PP 1", () => {
    cy.get("#productPrice").type(60);
    cy.get("#productPrice").should("have.value", "60");
  });

  it("PP 2", () => {
    cy.get("#productPrice").type("samir");
    cy.get("#productPrice").should("not.have.value", "samir");
  });

  it("PP 3", () => {
    cy.get("#productPrice").type("#@$");
    cy.get("#productPrice").should("not.have.value", "#@$");
  });

  it("PP 4", () => {
    cy.get("#productPrice").type("");
    cy.get("#productPrice").should("not.have.value", "");
  });
});
