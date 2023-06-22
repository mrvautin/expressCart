/* eslint-disable no-undef */
/* eslint-disable quotes */
describe("newUser", () => {
  beforeEach("get newUser", () => {
    cy.visit("http://localhost:1111");
  });

  it("test id S1", () => {
    cy.get(":nth-child(4) > .sidebar-link-addon").type("maletin");
    cy.get("#btn_search").click();
    cy.get(":nth-child(4) > .sidebar-link-addon").should(
      "have.value",
      "maletin"
    );
    cy.url("http://localhost:1111/search/maletin");
  });

  it("test id S2", () => {
    cy.get(":nth-child(4) > .sidebar-link-addon").type("1234");
    cy.get("#btn_search").click();
    cy.get(":nth-child(4) > .sidebar-link-addon").should(
      "not.have.value",
      "1234"
    );
    cy.url("http://localhost:1111/search/maletin");
  });

  it("test id S3", () => {
    cy.get(":nth-child(4) > .sidebar-link-addon").type("@maletin#");
    cy.get("#btn_search").click();
    cy.get(":nth-child(4) > .sidebar-link-addon").should(
      "not.have.value",
      "@maletin#"
    );
    cy.url("http://localhost:1111/search/maletin");
  });

  it("test id S4", () => {
    cy.get(":nth-child(4) > .sidebar-link-addon").type("");
    cy.get("#btn_search").click();
    cy.get(":nth-child(4) > .sidebar-link-addon").should("not.have.value", "");
    cy.url("http://localhost:1111/search/maletin");
  });
});
