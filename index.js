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
const multer = require("multer")
const path = require("path")
app.use(express.urlencoded({ extended: true }));
app.use(express.json())

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, './public/images/');
    console.log('Guardando archivo en:', uploadPath);  // Esto te ayudará a verificar la ruta
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });
let mesas = {};  
const fs = require("node:fs")

app.use('/public', express.static('public', {
  maxAge: 0,  // Sin caché, siempre se solicita al servidor
})); 
// app.use(multer({storage: storage, dest: path.join(__dirname, "./public/images")}).single("image"))
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



let mesasConectadas = new Map()
let clientTimeouts = new Map(); 

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

  socket.on("newFetch", () => {
    io.emit("doNewFetch")
  })

    socket.on('unirse_mesa', (tableNumber) => {
      socket.tableNumber = tableNumber
      mesasConectadas.set(socket.id, tableNumber);
      // startClientTimeout(socket);
      socket.join(tableNumber);
      io.emit('enviar_mesa_admin', tableNumber)
      console.log("SE HA UNIDO LA MESA NUMERO: " + tableNumber)
    
      resetClientTimeout(socket)
    });

    const resetClientTimeout = (socket) => {
      // Limpiar el timeout si ya existe
      if (clientTimeouts.has(socket.id)) {
        clearTimeout(clientTimeouts.get(socket.id));
        clientTimeouts.delete(socket.id);
      }
    
      // Establecer un nuevo timeout que desconectará al cliente después de 15 segundos sin actividad
      clientTimeouts.set(socket.id, setTimeout(() => {
        console.log(`Cliente desconectado por inactividad: ${socket.id}, mesa: ${socket.tableNumber}`);
    
        // Eliminar al cliente de la lista de mesas conectadas
        mesasConectadas.delete(socket.id);
    
        // Emitir evento de desconexión a todos
        io.emit("cliente_desconectado", socket.tableNumber); // Emitir evento a todos
        socket.emit('cliente_desconectado',  socket.tableNumber ); // Emitir evento solo al cliente
    
        // Desconectar al cliente
        // socket.disconnect();
      }, 61000)); // 15 segundos sin recibir un pong (inactividad)
    };

  
  
    socket.on('solicitar_mesero', (tableNumber) => {
      // io.to(tableNumber).emit('desactivar_boton_cliente');
      io.emit('solicitar_mesero', tableNumber);
      // console.log("EL CLIENTE DE LA MESA " + tableNumber + " SU BOTON DEBE ESTAR DESACTIVADO Y EN EL ADMIN DEBE ESTAR ACTIVADO")
    
    });


    const stopPingPong = (socket) => {
      try {
        console.log(`Deteniendo el sistema de Ping-Pong para el cliente ${socket.id}`);
        
        // Limpiar el timeout si ya existe
        if (clientTimeouts.has(socket.id)) {
          clearTimeout(clientTimeouts.get(socket.id));
          clientTimeouts.delete(socket.id); // Eliminar del mapa
        }
    console.log(`Cliente ${socket.id} procesado por inactividad.`);
        } catch (error) {
        console.error('Error al detener el sistema de Ping-Pong: ', error);
      }
    };
    

    socket.on("custom_disconnect", (tableNumber) => {
      console.log('Conectado, tableNumber recibido:', tableNumber);
     socket.tableNumber = tableNumber
     stopPingPong(socket);
     clientTimeouts.delete(socket.id); 
     mesasConectadas.delete(socket.id);
io.to(socket.tableNumber).emit("cliente_desconectado", socket.tableNumber)

    }) 



    socket.on('ping', (data) => {
      try {
        console.log(`Ping recibido del cliente ${data.id}, mesa: ${data.tableNumber}`);
    
        // Respondemos con un pong al cliente
        socket.to(data.id).emit('pong', { tableNumber: data.tableNumber }); 
    
        // Reiniciar el temporizador de inactividad del cliente cada vez que se recibe un ping
        resetClientTimeout(socket);
      } catch (error) {
        console.error('Error al recibir el ping del cliente: ', error);
      }
    });



    socket.on('enviar_mesero', (tableNumber) => {
      // io.to(tableNumber).emit('activar_boton_cliente');
      // io.emit('desactivar_boton_admin', tableNumber);

  io.emit('mesero_enviado', tableNumber); // Confirmar que el mesero fue enviado
console.log("SE HA ENVIADO UN MESERO A LA MESA " + tableNumber + " EL BOTON EN EL ADMIN DEBE DESACIVARSE Y EN EL CLIENTE ACTIVARSE")    
});
  });;

// CONFIGURACIONES A LA BASE DE DATOS

// const connection = mysql.createConnection({
//   host: "bcxurofl7mlbgmuudmrg-mysql.services.clever-cloud.com",
//   user: "uzq5bc0q4mklwyo9",
//   password: "6OOChzlLqKUH5pSTKQco",
//   database: "bcxurofl7mlbgmuudmrg",
//   port: 3306
// });

const connection = mysql.createPool({
  host: "bcxurofl7mlbgmuudmrg-mysql.services.clever-cloud.com",
  user: "uzq5bc0q4mklwyo9",
  password: "6OOChzlLqKUH5pSTKQco",
  database: "bcxurofl7mlbgmuudmrg",
  port: 3306,
  waitForConnections: true,
  connectionLimit: 5, // Número de conexiones en el pool
  queueLimit: 0
});

// connection.connect((err) => {
//   if (err) {
//     console.error("Error de conexión a la base de datos:", err);
//   } else {
//     console.log("Conexión a la base de datos establecida");
//   }
// });

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


app.delete("/deleteOneRegister", (req, res) => {
  // Asegurarse de que el id esté en el cuerpo de la solicitud
  const dateId = req.body.id; 
  
  if (!dateId) {
    return res.status(400).json({ error: "ID no proporcionado" });
  }

  // Consulta SQL para eliminar el registro con el id proporcionado en la tabla 'pedidos'
  const sql = 'DELETE FROM registro WHERE id = ?';

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
  const sql = 'SELECT id, date, data, totalPay FROM registro';
  connection.query(sql, (err, result) => {
    if (err) {
      console.error('Error al enviar datos al administrador', err);
      res.status(500).json({ error: 'Error interno del servidor' });
      return;
    }
    // console.log('Datos enviados al administrador');
    res.status(200).json(result);
  });
});


// ACTUALIZACIONES VERSION 2.0

// DESCARGAR MENU

app.get('/foodGet', (req, res) => {
 
  // Enviador datos al frontend
  // console.log('Solicitud GET recibida en /foodGet');
  const sql = 'SELECT id, ingredients, name, kcal, image FROM food';
  connection.query(sql, (err, result) => {
    if (err) {
      console.error('Error al enviar datos al administrador', err);
      res.status(500).json({ error: 'Error interno del servidor' });
      return;
    }
    // console.log('Carta de comida enviada al administrador');
    res.status(200).json(result);
  });
});



app.get('/drinkGet', (req, res) => {
 
  // Enviador datos al frontend
  const sql = 'SELECT id, name, ingredients, kcal, image FROM drink';
  connection.query(sql, (err, result) => {
    if (err) {
      console.error('Error al enviar datos al administrador', err);
      res.status(500).json({ error: 'Error interno del servidor' });
      return;
    }
    // console.log('Carta de comida enviada al administrador');
    res.status(200).json(result);
  });
});



app.get('/dessertGet', (req, res) => {
 
  // Enviador datos al frontend
  const sql = 'SELECT id, name, ingredients, kcal, image FROM dessert';
  connection.query(sql, (err, result) => {
    if (err) {
      console.error('Error al enviar datos al administrador', err);
      res.status(500).json({ error: 'Error interno del servidor' });
      return;
    }
    // console.log('Carta de comida enviada al administrador');
    res.status(200).json(result);
  });
});

// Este es el código corregido:
app.post("/sendFood", upload.single("image"), (req, res) => {
  const { name, kcal, ingredients } = req.body;
  console.log('Archivo recibido:', req.file); // Aquí se imprimirá el archivo subido
  console.log('Datos del formulario:', req.body);

  if (!req.file) {
    return res.status(400).send('No se ha enviado ninguna imagen.');
  }

  const imagenName = req.file.originalname; // El nombre del archivo de la imagen

  const sql = 'INSERT INTO food (name, kcal, ingredients, image) VALUES (?, ?, ?, ?)';
  connection.query(sql, [name, kcal, ingredients, imagenName], (err, result) => {
    if (err) {
      console.error('Error al insertar datos en la tabla food:', err);
      return res.status(500).send('Error al insertar datos en la tabla food');
    }

    res.status(201).json({ message: 'Datos insertados correctamente', filename: imagenName });;
  });
});

app.post("/sendDrink", upload.single("image"), (req, res) => {
  const { name, kcal, ingredients } = req.body;
  console.log('Archivo recibido:', req.file); // Aquí se imprimirá el archivo subido
  console.log('Datos del formulario:', req.body);

  if (!req.file) {
    return res.status(400).send('No se ha enviado ninguna imagen.');
  }

  const imagenName = req.file.originalname; // El nombre del archivo de la imagen

  const sql = 'INSERT INTO drink (name, kcal, ingredients, image) VALUES (?, ?, ?, ?)';
  connection.query(sql, [name, kcal, ingredients, imagenName], (err, result) => {
    if (err) {
      console.error('Error al insertar datos en la tabla food:', err);
      return res.status(500).send('Error al insertar datos en la tabla food');
    }

    res.status(201).json({ message: 'Datos insertados correctamente', filename: imagenName });;
  });
});

app.post("/sendDessert", upload.single("image"), (req, res) => {
  const { name, kcal, ingredients } = req.body;
  console.log('Archivo recibido:', req.file); // Aquí se imprimirá el archivo subido
  console.log('Datos del formulario:', req.body);

  if (!req.file) {
    return res.status(400).send('No se ha enviado ninguna imagen.');
  }

  const imagenName = req.file.originalname; // El nombre del archivo de la imagen

  const sql = 'INSERT INTO dessert (name, kcal, ingredients, image) VALUES (?, ?, ?, ?)';
  connection.query(sql, [name, kcal, ingredients, imagenName], (err, result) => {
    if (err) {
      console.error('Error al insertar datos en la tabla food:', err);
      return res.status(500).send('Error al insertar datos en la tabla food');
    }

    res.status(201).json({ message: 'Datos insertados correctamente', filename: imagenName });;
  });
});



app.delete("/foodDelete", (req, res) => {
  // Asegurarse de que el id esté en el cuerpo de la solicitud
  const dateId = req.body.id; 
  
  if (!dateId) {
    return res.status(400).json({ error: "ID no proporcionado" });
  }

  // Consulta SQL para eliminar el registro con el id proporcionado en la tabla 'pedidos'
  const sql = 'DELETE FROM food WHERE id = ?';

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



app.delete("/drinkDelete", (req, res) => {
  // Asegurarse de que el id esté en el cuerpo de la solicitud
  const dateId = req.body.id; 
  
  if (!dateId) {
    return res.status(400).json({ error: "ID no proporcionado" });
  }

  // Consulta SQL para eliminar el registro con el id proporcionado en la tabla 'pedidos'
  const sql = 'DELETE FROM drink WHERE id = ?';

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



app.delete("/dessertDelete", (req, res) => {
  // Asegurarse de que el id esté en el cuerpo de la solicitud
  const dateId = req.body.id; 
  
  if (!dateId) {
    return res.status(400).json({ error: "ID no proporcionado" });
  }

  // Consulta SQL para eliminar el registro con el id proporcionado en la tabla 'pedidos'
  const sql = 'DELETE FROM dessert WHERE id = ?';

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


// LOGO


app.put("/changeLogo", upload.single("image"), (req, res) => {


  if (!req.file) {
    return res.status(400).send('No se ha enviado ninguna imagen.');
  }

  const imagenName = req.file.originalname; // El nombre del archivo de la imagen

  // Primero, eliminamos el registro anterior
  const deleteSql = 'DELETE FROM logo WHERE 1';
  connection.query(deleteSql, (err) => {
    if (err) {
      console.error('Error al eliminar el registro anterior:', err);
      return res.status(500).send('Error al eliminar el registro anterior');
    }

    // Luego, insertamos el nuevo archivo
    const insertSql = 'INSERT INTO logo (logo) VALUES (?)';
    connection.query(insertSql, [imagenName], (err, result) => {
      if (err) {
        console.error('Error al insertar datos en la tabla logo:', err);
        return res.status(500).send('Error al insertar datos en la tabla logo');
      }

      res.status(201).json({ message: 'Logo actualizado correctamente', filename: imagenName });
    });
  });
});
app.get("/getLogo", (req, res) => {
  const sql = "SELECT * FROM logo WHERE 1";

  connection.query(sql, (err, result) => {
    if (err) {
      console.log("Error al enviar el logo: " + err);
      return res.status(500).send("Error al enviar el logo");
    }

    if (result.length > 0) {
      console.log("Logo enviado exitosamente");
      return res.status(200).json(result); // Enviamos los datos del logo
    } else {
      console.log("No se encontró un logo.");
      return res.status(404).send("No se encontró un logo.");
    }
  });
});

app.put("/changeSound", upload.single("sound"), (req, res) => {


  if (!req.file) {
    return res.status(400).send('No se ha enviado ninguna imagen.');
  }

  const imagenName = req.file.originalname; // El nombre del archivo de la imagen

  // Primero, eliminamos el registro anterior
  const deleteSql = 'DELETE FROM sound WHERE 1';
  connection.query(deleteSql, (err) => {
    if (err) {
      console.error('Error al eliminar el registro anterior:', err);
      return res.status(500).send('Error al eliminar el registro anterior');
    }

    // Luego, insertamos el nuevo archivo
    const insertSql = 'INSERT INTO sound (sound) VALUES (?)';
    connection.query(insertSql, [soundName], (err, result) => {
      if (err) {
        console.error('Error al insertar datos en la tabla logo:', err);
        return res.status(500).send('Error al insertar datos en la tabla logo');
      }

      res.status(201).json({ message: 'Logo actualizado correctamente', filename: imagenName });
    });
  });
});

app.get("/getSound", (req, res) => {
  const sql = "SELECT * FROM sound WHERE 1";

  connection.query(sql, (err, result) => {
    if (err) {
      console.log("Error al enviar el logo: " + err);
      return res.status(500).send("Error al enviar el logo");
    }

    if (result.length > 0) {
      console.log("Logo enviado exitosamente");
      return res.status(200).json(result); // Enviamos los datos del logo
    } else {
      console.log("No se encontró un logo.");
      return res.status(404).send("No se encontró un logo.");
    }
  });
});

app.put("/changeStateEffectSounds", (req, res) => {
  const { data } = req.body;

  // Primero, eliminamos el registro anterior
  const deleteSql = 'DELETE FROM stateSound WHERE 1';
  connection.query(deleteSql, (err) => {
    if (err) {
      console.error('Error al eliminar el registro anterior:', err);
      return res.status(500).send('Error al eliminar el registro anterior');
    }

    // Luego, insertamos el nuevo estado
    const insertSql = 'INSERT INTO stateSound (sound) VALUES (?)';
    connection.query(insertSql, [data], (err, result) => {
      if (err) {
        console.error('Error al insertar datos en la tabla stateSound:', err);
        return res.status(500).send('Error al insertar datos en la tabla stateSound');
      }

      res.status(201).json({ message: 'Estado actualizado correctamente' });
    });
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
//   // Cuando la cocina responde que ha enviado el mesero
//   socket.on('enviar_mesero', (tableNumber) => {
//     console.log(`Cocina/mesero ha enviado al mesero a la mesa ${tableNumber}`);
  
//     // Emitir mensaje a la mesa para habilitar el botón
//     io.to(tableNumber).emit('activar_boton_cliente', tableNumber);
  
//     // Emitir mensaje a los administradores para deshabilitar el botón
//     io.emit('desactivar_boton_admin', tableNumber);
//   });


