import { Button, FluentProvider, webLightTheme } from "@fluentui/react-components";
import { useState } from "react";

import "./App.css";

const App = () => {
  const [status, setStatus] = useState("El componente está listo.");

  return (
    <FluentProvider theme={webLightTheme}>
      <main className="container">
        <section className="demo-card" aria-labelledby="demo-title">
          <p className="eyebrow">Prueba de integración</p>
          <h1 id="demo-title">Fluent UI React</h1>
          <p className="description">
            Este botón de Fluent UI está renderizado dentro de una aplicación React.
          </p>
          <Button
            appearance="primary"
            onClick={() => setStatus("El botón Fluent UI respondió correctamente.")}
          >
            Probar interacción
          </Button>
          <p className="status" role="status">
            {status}
          </p>
        </section>
      </main>
    </FluentProvider>
  );
};

export default App;
