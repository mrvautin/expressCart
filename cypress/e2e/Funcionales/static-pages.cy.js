/* eslint-disable no-undef */
/* eslint-disable quotes */
describe("Pruebas editar direccion y telefono de cliente", () => {
  beforeEach(() => {
    cy.visit("http://localhost:1111/admin");
  });
  it("Numero aceptable", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(3) > .nav-link").click();
    cy.get(".float-right > .btn").click();
    cy.get("#pageName").type("Trabaja con nostros");
    cy.get("#pageSlug").type("trabaja");
    cy.get(".note-editable").type("A continuacion veras nuestras vacantes");
    cy.get("#btnPageUpdate").click();
    cy.get("#notify_message").contains("New page successfully created");
  });
  it("Numero aceptable", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(3) > .nav-link").click();
    cy.get(".float-right > .btn").click();
    cy.get("#pageName").type("*");
    cy.get("#pageSlug").type("trabaja");
    cy.get(".note-editable").type("A continuacion veras nuestras vacantes");
    cy.get("#btnPageUpdate").click();
    cy.get("#notify_message").should("have.text", "Name is not correct");
  });
  it("Numero aceptable", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(3) > .nav-link").click();
    cy.get(".float-right > .btn").click();
    cy.get("#pageName").type("");
    cy.get("#pageSlug").type("trabaja");
    cy.get(".note-editable").type("A continuacion veras nuestras vacantes");
    cy.get("#btnPageUpdate").click();
    cy.get("#notify_message").should("have.text", "Page name is empty");
  });
  it("Numero aceptable", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(3) > .nav-link").click();
    cy.get(".float-right > .btn").click();
    cy.get("#pageName").type("Trabaja con nostros");
    cy.get("#pageSlug").type("*");
    cy.get(".note-editable").type("A continuacion veras nuestras vacantes");
    cy.get("#btnPageUpdate").click();
    cy.get("#notify_message").should("have.text", "Route is not correct");
  });
  it("Numero aceptable", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(3) > .nav-link").click();
    cy.get(".float-right > .btn").click();
    cy.get("#pageName").type("Trabaja con nostros");
    cy.get("#pageSlug").type("");
    cy.get(".note-editable").type("A continuacion veras nuestras vacantes");
    cy.get("#btnPageUpdate").click();
    cy.get("#notify_message").should("have.text", "Route is empty");
  });
  it("Numero aceptable", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(3) > .nav-link").click();
    cy.get(".float-right > .btn").click();
    cy.get("#pageName").type("Trabaja con nostros");
    cy.get("#pageSlug").type("trabaja");
    cy.get(".note-editable").type("");
    cy.get("#btnPageUpdate").click();
    cy.get("#notify_message").should("have.text", "Page content is empty");
  });
});
