const express = require("express");
const cors = require("cors");
const port = 4000;
const port2 = 5000;
const app = express();
const socketIO = require("socket.io");
const http = require("http");
const server = http.createServer(app);
const mysql = require("mysql");
const { table } = require("console");
let mesas = {};  

app.use(express.json())
app.options('*', (req, res) => {
  const allowedOrigins = ['https://robin2715.github.io/admin', 'https://robin2715.github.io'];
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

  const allowedOrigins = ['https://robin2715.github.io/admin', 'https://robin2715.github.io'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  next();
});

const corsOptions = {
  // origin: 'https://diningexperiencesource.shop', // Reemplaza con la URL de tu aplicación frontend
  origin:  ['https://robin2715.github.io/admin', 'https://robin2715.github.io'],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
  allowedHeaders: "Content-Type,Authorization",
};

app.use(cors(corsOptions))

// const io = socketIO(server, {
//   path: "/socket",
//   cors: corsOptions,
// });

const io = socketIO(server, {
  path: '/socket',
  cors: {
    origin: ['https://robin2715.github.io', 'https://robin2715.github.io/admin'],
    methods: ['GET', 'POST'],
    credentials: true,  // Permitir cookies y credenciales si es necesario
  },
});

server.listen(port, () => {
  console.log("servidor macdonalds conectado");
});

app.get("/", (req, res) => {
  res.send("el servidor funciona");
});


const mesasConectadas = new Map();

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);
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

  socket.on('mensajeChat', (mensaje) => {
    console.log("Mensaje del chat:", mensaje); // Verifica que este mensaje se muestre
    io.emit('nuevoMensaje', mensaje);
  });

 
  
    socket.on('unirse_mesa', (tableNumber) => {
      socket.tableNumber = tableNumber
      mesasConectadas.set(socket.id, tableNumber);
      socket.join(tableNumber);
      io.emit('enviar_mesa_admin', tableNumber)
      console.log("SE HA UNIDO LA MESA NUMERO: " + tableNumber)
    });

  
  
    socket.on('solicitar_mesero', (tableNumber) => {
      // io.to(tableNumber).emit('desactivar_boton_cliente');
      io.emit('solicitar_mesero', tableNumber);
      console.log("EL CLIENTE DE LA MESA " + tableNumber + " SU BOTON DEBE ESTAR DESACTIVADO Y EN EL ADMIN DEBE ESTAR ACTIVADO")
    
    });

    socket.on("custom_disconnect", (tableNumber) => {
      console.log('Conectado, tableNumber recibido:', tableNumber);
     socket.tableNumber = tableNumber
     stopPingPong();
     mesasConectadas.delete(socket.id);
io.emit("cliente_desconectado", socket.tableNumber)

    }) 

    // LOGICA PING PONG EXPERIMENTAL 
    let pingInterval;
    let pongTimeout;
  
    // Función para iniciar el sistema ping-pong
    const startPingPong = () => {
      // Enviar un ping cada 10 segundos
      pingInterval = setInterval(() => {
        if (socket.connected) {
          console.log(`Enviando ping al cliente ${socket.id}`);
          socket.emit('ping', { tableNumber: socket.tableNumber });
  
          // Establecer un timeout para esperar el pong
          pongTimeout = setTimeout(() => {
            console.log(`No se recibió pong del cliente ${socket.id}, consideramos desconectado.`);
            mesasConectadas.delete(socket.id); 
            socket.emit('custom_disconnect', socket.tableNumber); // Emitir desconexión
         
            stopPingPong();
  
            // Eliminar del mapa de conexiones activas
            
  
            // Emitir evento de desconexión con el tableNumber
           }, 5000); // 5 segundos para esperar el pong
        }
      }, 10000); // Enviar ping cada 10 segundos
    };
  
    // Función para detener el sistema Ping-Pong
    const stopPingPong = () => {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      if (pongTimeout) {
        clearTimeout(pongTimeout);
        pongTimeout = null;
      }
    };
  
    // Iniciar el ping-pong cuando el cliente se conecta
    startPingPong();
  
    // Escuchar el pong del cliente
    socket.on('pong', (data) => {
      console.log(`Pong recibido del cliente ${socket.id}`);
      
      // Si se recibe el pong, cancelar el timeout del servidor y continuar con el siguiente ciclo
      clearTimeout(pongTimeout);
      pongTimeout = null; // Reiniciar el timeout
  
      // Iniciar el ping nuevamente después de 10 segundos
      startPingPong(); // Reiniciar el ciclo de ping
    });
  
    // -----------------------------------


    socket.on('enviar_mesero', (tableNumber) => {
      // io.to(tableNumber).emit('activar_boton_cliente');
      // io.emit('desactivar_boton_admin', tableNumber);

  io.emit('mesero_enviado', tableNumber); // Confirmar que el mesero fue enviado
console.log("SE HA ENVIADO UN MESERO A LA MESA " + tableNumber + " EL BOTON EN EL ADMIN DEBE DESACIVARSE Y EN EL CLIENTE ACTIVARSE")    
});
  });;

// CONFIGURACIONES A LA BASE DE DATOS

const connection = mysql.createConnection({
  host: "bcxurofl7mlbgmuudmrg-mysql.services.clever-cloud.com",
  user: "uzq5bc0q4mklwyo9",
  password: "6OOChzlLqKUH5pSTKQco",
  database: "bcxurofl7mlbgmuudmrg",
  port: 3306
});

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


// ELIMINAR UN PEDIDO DE LA BASE DE DATOS DEL DIA

app.delete("/deleteOneDate", (req, res) => {
  // Asegurarse de que el id esté en el cuerpo de la solicitud
  const dateId = req.body.id; 
  
  if (!dateId) {
    return res.status(400).json({ error: "ID no proporcionado" });
  }

  // Consulta SQL para eliminar el registro con el id proporcionado en la tabla 'pedidos'
  const sql = 'DELETE FROM pedidos WHERE id = ?';

  connection.query(sql, [dateId], (err, result) => {
    if (err) {
      console.error('Error al eliminar el registro', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
    
    // Si no se encontró ningún registro con ese ID, devolver un mensaje
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'No se encontró el registro con ese ID' });
    }

    console.log('Registro eliminado');
    res.status(200).json({ message: 'Registro eliminado correctamente', result });
  });
});




// METODO POST GUARDAR BASE DE DATOS

app.post("/savePayOfDay", (req, res) => {
  const { date, data, totalPay } = req.body;

  // Asegúrate de que 'data' sea una cadena JSON válida.
  const sql = 'INSERT INTO registro (date, data, totalPay) VALUES (?, ?, ?)';
  connection.query(sql, [date, JSON.stringify(data), totalPay], (err, result) => {
    if (err) {
      console.error('Error al insertar datos en la tabla Pedidos:', err);
      res.status(500).send('Error al insertar datos en la tabla Pedidos');
      return;
    }

    res.status(201).send('Datos insertados correctamente');
  });
});

// envio registro al frontend


app.get('/registroGet', (req, res) => {
 
  // Enviador datos al frontend
  const sql = 'SELECT date, data, totalPay FROM registro';
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



  // socket.on('unirse_mesa', (tableNumber) => {
  //   socket.join(tableNumber);  // Unir el socket al room de la mesa
  //   mesas[tableNumber] = socket.id;  // Almacenar el socket para la mesa
  //   console.log(`Mesa ${tableNumber} unida con socket ID: ${socket.id}`);
  // });

  // socket.on('solicitar_mesero', (tableNumber) => {
  //   console.log(`Mesa ${tableNumber} ha solicitado un mesero`);
  
  //   // Emitir mensaje a todos los administradores para habilitar el botón
  //   io.emit('activar_boton_admin', tableNumber);
  
  //   // Emitir mensaje a la mesa específica para deshabilitar el botón
  //   io.to(tableNumber).emit('desactivar_boton_cliente', tableNumber);
  // });
  
  // // Cuando la cocina responde que ha enviado el mesero
  // socket.on('enviar_mesero', (tableNumber) => {
  //   console.log(`Cocina/mesero ha enviado al mesero a la mesa ${tableNumber}`);
  
  //   // Emitir mensaje a la mesa para habilitar el botón
  //   io.to(tableNumber).emit('activar_boton_cliente', tableNumber);
  
  //   // Emitir mensaje a los administradores para deshabilitar el botón
  //   io.emit('desactivar_boton_admin', tableNumber);
  // });


