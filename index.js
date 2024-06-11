const express = require("express");
const cors = require("cors");
const port = 4000;
const port2 = 5000;
const app = express();
const socketIO = require("socket.io");
const http = require("http");
const server = http.createServer(app);
const mysql = require("mysql")


app.use(express.json())
app.options('*', (req, res) => {
  const allowedOrigins = ['https://cristiansanchez2715.github.io/admin', 'https://cristiansanchez2715.github.io'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.send();
});

// Middleware de registro de solicitudes
app.use((req, res, next) => {
  console.log('Solicitud recibida:', req.method, req.url);
  console.log('Cuerpo de la solicitud:', req.body);

  const allowedOrigins = ['https://cristiansanchez2715.github.io/admin', 'https://cristiansanchez2715.github.io'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  next();
});

const corsOptions = {
  // origin: 'https://diningexperiencesource.shop', // Reemplaza con la URL de tu aplicación frontend
  origin:  ['https://cristiansanchez2715.github.io/admin', 'https://cristiansanchez2715.github.io'],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
  allowedHeaders: "Content-Type,Authorization",
};

app.use(cors(corsOptions))

const io = socketIO(server, {
  path: "/socket",
  cors: corsOptions,
});

server.listen(port, () => {
  console.log("servidor macdonalds conectado");
});

app.get("/", (req, res) => {
  res.send("el servidor funciona");
});



io.on("connection", (socket) => {
  console.log("Cliente conectado");

  socket.on('nuevoPedido', (data) => {
    console.log("Nuevo pedido desde el cliente:", data);
    // Aquí puedes procesar el pedido y enviarlo a la cocina, guardar en una base de datos, etc.
    // Por ejemplo, puedes emitir un evento para notificar a la cocina sobre el nuevo pedido.
    io.emit("pedidoALaCocina", data);
    const {products, table, totalPayOrder} = data;

    // Convertir el objeto products a una cadena JSON
    const productsJSON = JSON.stringify(products);
   
    // Insertar datos en la tabla Pedidos
    const sql = 'INSERT INTO pedidos (table_number, products, totalPayOrder) VALUES (?, ?, ?)';
    connection.query(sql, [table, productsJSON,  totalPayOrder], (err, result) => {
      if (err) {
        console.error('Error al insertar datos en la tabla Pedidos:', err);
        // Enviar mensaje de error al cliente a través del socket
        socket.emit('error', 'Error al insertar datos en la tabla Pedidos');
        return;
      }
      console.log('Datos insertados en la tabla Pedidos');
      // Enviar mensaje de éxito al cliente a través del socket
      socket.emit('success', 'Datos insertados correctamente en la tabla Pedidos');
    });
  });
});

// CONFIGURACIONES A LA BASE DE DATOS

const connection = mysql.createConnection({
'host': "b8d1amcp16oqfzl3peey-mysql.services.clever-cloud.com",
'user': 'umhtwogrmnehnwne',
'password': 'ljzTECX2TkwBUuY8yGoZ',
'database': 'b8d1amcp16oqfzl3peey',
'port': 3306
})

connection.connect((err) => {
  if (err) {
    console.error("Error de conexión a la base de datos:", err);
  } else {
    console.log("Conexión a la base de datos establecida");
  }
});

// enviar pedidos al admin


app.get('/dataBaseGet', (req, res) => {
 
  // Enviador datos al frontend
  const sql = 'SELECT id, table_number, products, totalPayOrder FROM pedidos';
  connection.query(sql, (err, result) => {
    if (err) {
      console.error('Error al enviar datos al administrador', err);
      res.status(500).json({ error: 'Error interno del servidor' });
      return;
    }
    console.log('Datos enviados al administrador');
    res.status(200).json(result);
  });
});

// Configurar el servidor para escuchar en el puerto 4000

app.put('/cleanDataBase', (req, res) => {
  const sql = "DELETE FROM pedidos;";
  connection.query(sql, (err, result) => {
    if (err) {
      console.error("Error al borrar los pedidos de la tabla:", err);
      res.status(500).json({ error: "Error interno del servidor" });
      return;
    }
    console.log("Se han eliminado todos los pedidos de la tabla correctamente");
    res.status(200).json({ message: "Pedidos eliminados correctamente" });
  });
});