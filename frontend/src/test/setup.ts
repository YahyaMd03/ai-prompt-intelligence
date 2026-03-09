import "@testing-library/jest-dom";

// JSDOM doesn't implement scrollTo on elements; our chat auto-scroll uses it.
if (!("scrollTo" in HTMLElement.prototype)) {
  (HTMLElement.prototype as any).scrollTo = function scrollTo() {};
}
