import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App"; // ✅ "../App" → "./App" に修正！

test("renders app component without crashing", () => {
  render(<App />);
  const titleElement = screen.getByText(/バリアフリーデザインチェッカー/i);
  expect(titleElement).toBeInTheDocument();
});