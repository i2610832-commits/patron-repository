const express = require('express');
const app = express();
app.use(express.json());

// 1. PATRÓN FACTORY
class FabricaProducto {
  static crear({ tipo, id, nombre, precio, stock, categoriaId, artesanoId }) {
    if (!nombre || precio <= 0) {
      throw new Error('Nombre y precio válido son requeridos.');
    }
    return {
      id: id || Date.now(),
      tipo,
      nombre,
      precio: parseFloat(precio),
      stock: parseInt(stock, 10) || 0,
      categoriaId,
      artesanoId,
      fechaCreacion: new Date()
    };
  }
}

// 2. PATRÓN OBSERVER
class ServicioNotificaciones {
  constructor() {
    this.subscriptores = {};
  }
  suscribir(evento, callback) {
    if (!this.subscriptores[evento]) this.subscriptores[evento] = [];
    this.subscriptores[evento].push(callback);
  }
  publicar(evento, datos) {
    if (this.subscriptores[evento]) {
      this.subscriptores[evento].forEach(cb => cb(datos));
    }
  }
}

const buscadorEventos = new ServicioNotificaciones();
const bitacoraEventos = [];

buscadorEventos.suscribir('pedidoCreado', (datos) => {
  bitacoraEventos.push({ evento: 'pedidoCreado', datos, fecha: new Date() });
});

buscadorEventos.suscribir('pagoProcesado', (datos) => {
  bitacoraEventos.push({ evento: 'pagoProcesado', datos, fecha: new Date() });
});

// 3. PATRÓN REPOSITORY
class RepositorioMemoria {
  constructor() {
    this.categorias = ['Cerámica', 'Textil', 'Joyería', 'Artesanía'];
    this.artesanos = [
      { id: 1, nombre: 'Artesanos del Valle' },
      { id: 2, nombre: 'Taller San Pedro' }
    ];
    this.productos = [];
    this.pedidos = [];
  }
  guardarProducto(producto) {
    this.productos.push(producto);
    return producto;
  }
  buscarProductos({ categoria, q }) {
    return this.productos.filter(p => {
      const coincideCat = categoria ? p.categoriaId === categoria : true;
      const coincideQ = q ? p.nombre.toLowerCase().includes(q.toLowerCase()) : true;
      return coincideCat && coincideQ;
    });
  }
  guardarPedido(pedido) {
    this.pedidos.unshift(pedido);
    return pedido;
  }
  buscarPedidoPorId(id) {
    return this.pedidos.find(p => p.id === Number(id));
  }
}

const db = new RepositorioMemoria();

// 4. PATRÓN STRATEGY
const ESTRATEGIAS = {
  yape: {
    camposRequeridos: ['codigo'],
    procesar: (pedido, datos) => {
      if (!datos.codigo) throw new Error('Código Yape es requerido.');
      return { exito: true, metodo: 'Yape', transaccionId: `YAPE-${Date.now()}` };
    }
  },
  tarjeta: {
    camposRequeridos: ['numeroTarjeta', 'cvv'],
    procesar: (pedido, datos) => {
      if (!datos.numeroTarjeta || !datos.cvv) throw new Error('Datos de tarjeta incompletos.');
      return { exito: true, metodo: 'Tarjeta', transaccionId: `CARD-${Date.now()}` };
    }
  }
};

// RUTAS API REST
app.get('/api/categorias', (req, res) => res.status(200).json(db.categorias));
app.get('/api/artesanos', (req, res) => res.status(200).json(db.artesanos));
app.get('/api/productos', (req, res) => {
  const { categoria, q } = req.query;
  res.status(200).json(db.buscarProductos({ categoria, q }));
});
app.post('/api/productos', (req, res) => {
  try {
    const nuevo = FabricaProducto.crear(req.body);
    res.status(201).json(db.guardarProducto(nuevo));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.get('/api/metodos-pago', (req, res) => {
  const metodos = Object.keys(ESTRATEGIAS).map(k => ({ metodo: k, campos: ESTRATEGIAS[k].camposRequeridos }));
  res.status(200).json(metodos);
});
app.post('/api/pedidos', (req, res) => {
  try {
    const { items, cliente } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'El carrito no puede estar vacío' });
    const nuevoPedido = {
      id: Date.now(),
      cliente: cliente || 'Anónimo',
      items,
      estado: 'PENDIENTE',
      total: items.reduce((acc, item) => acc + (item.precio * item.cantidad), 0),
      fecha: new Date()
    };
    db.guardarPedido(nuevoPedido);
    buscadorEventos.publicar('pedidoCreado', nuevoPedido);
    res.status(201).json(nuevoPedido);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post('/api/pedidos/:id/pago', (req, res) => {
  try {
    const pedido = db.buscarPedidoPorId(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    const { metodoPago, datosPago } = req.body;
    const estrategia = ESTRATEGIAS[metodoPago];
    if (!estrategia) return res.status(400).json({ error: 'Método de pago no válido' });
    
    const resultadoPago = estrategia.procesar(pedido, datosPago);
    pedido.estado = 'PAGADO';
    buscadorEventos.publicar('pagoProcesado', { pedidoId: pedido.id, resultadoPago });
    res.status(200).json({ mensaje: 'Pago realizado con éxito', detalles: resultadoPago });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.get('/api/pedidos', (req, res) => res.status(200).json(db.pedidos));
app.get('/api/eventos', (req, res) => res.status(200).json(bitacoraEventos));

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor API REST corriendo en http://localhost:${PORT}`));