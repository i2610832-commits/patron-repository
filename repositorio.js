// ==========================================
// Excepción Personalizada del Dominio
// ==========================================
class ErrorDominio extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorDominio';
  }
}

// ==========================================
// 1. PATRÓN FACTORY (Creación de Productos)
// ==========================================
class Producto {
  constructor({ id, nombre, precio, categoria, artesano }) {
    this.id = id;
    this.nombre = nombre;
    this.precio = precio;
    this.categoria = categoria;
    this.artesano = artesano;
  }
}

const FabricaProducto = {
  crear(datos, artesano) {
    if (!artesano) throw new ErrorDominio('El producto debe tener un artesano');
    
    // Normaliza «S/ 45,50» a 45.5
    const precio = Number(
      String(datos.precio)
        .replace(/[^\d.,-]/g, '')
        .replace(',', '.')
    );

    if (!Number.isFinite(precio) || precio <= 0) {
      throw new ErrorDominio('Precio inválido');
    }

    return new Producto({
      id: datos.id || Date.now(),
      nombre: datos.nombre,
      precio: precio,
      categoria: datos.categoria || 'General',
      artesano: artesano
    });
  }
};

// ==========================================
// 2. PATRÓN REPOSITORY (Persistencia)
// ==========================================
class RepositorioMemoria {
  constructor() {
    this.elementos = [];
  }

  listar() {
    return this.elementos;
  }

  guardar(item) {
    this.elementos.push(item);
    return item;
  }
}

class RepositorioProductos extends RepositorioMemoria {
  buscar({ categoria, texto } = {}) {
    let resultado = this.listar();

    if (categoria && categoria !== 'Todos') {
      resultado = resultado.filter((p) => p.categoria === categoria);
    }

    if (texto) {
      const textoLower = texto.toLowerCase();
      resultado = resultado.filter((p) =>
        p.nombre.toLowerCase().includes(textoLower)
      );
    }

    return resultado;
  }
}

// ==========================================
// 3. PATRÓN STRATEGY (Procesamiento de Pagos)
// ==========================================
class PagoYape {
  procesar(pedido, datos) {
    if (!/^\d{6}$/.test(String(datos.codigo))) {
      throw new ErrorDominio('Código de 6 dígitos');
    }
    return {
      aprobado: true,
      referencia: `YAPE-${datos.codigo}`
    };
  }
}

class PagoTarjeta {
  procesar(pedido, datos) {
    if (!datos.numeroTarjeta || datos.numeroTarjeta.length < 16) {
      throw new ErrorDominio('Número de tarjeta inválido');
    }
    return { aprobado: true, referencia: `TARJETA-${datos.numeroTarjeta.slice(-4)}` };
  }
}

class PagoContraEntrega {
  procesar(pedido, datos) {
    return { aprobado: true, referencia: `CONTRAENTREGA-${pedido.id}` };
  }
}

const ESTRATEGIAS = {
  yape: new PagoYape(),
  tarjeta: new PagoTarjeta(),
  contraentrega: new PagoContraEntrega()
};

// ==========================================
// 4. PATRÓN OBSERVER (Publicador de Eventos)
// ==========================================
class ServicioNotificaciones {
  constructor() {
    this.suscriptores = {};
    this.bitacora = [];
  }

  suscribir(evento, manejador) {
    if (!this.suscriptores[evento]) {
      this.suscriptores[evento] = [];
    }
    this.suscriptores[evento].push(manejador);
  }

  publicar(evento, datos) {
    this.bitacora.unshift({ evento, datos });
    const manejadores = this.suscriptores[evento] || [];
    for (const manejador of manejadores) {
      manejador(datos); // notifica a cada observador
    }
  }
}

// ==========================================
// DEMOSTRACIÓN INTEGRADA DE LOS 4 PATRONES
// ==========================================
console.log('=== 1. Probando Factory ===');
const producto1 = FabricaProducto.crear(
  { id: 1, nombre: 'Cerámica Chulucanas', precio: 'S/ 45,50', categoria: 'Artesanía' },
  'Juan Pérez'
);
console.log('Producto creado exitosamente:', producto1);

console.log('\n=== 2. Probando Repository ===');
const repo = new RepositorioProductos();
repo.guardar(producto1);
repo.guardar(FabricaProducto.crear(
  { id: 2, nombre: 'Retablo Ayacuchano', precio: '120.00', categoria: 'Artesanía' },
  'Maria Quispe'
));
console.log('Búsqueda por categoría Artesanía:', repo.buscar({ categoria: 'Artesanía' }));

console.log('\n=== 3. Probando Strategy ===');
const pedidoEjemplo = { id: 101, total: 45.50 };
const metodoPago = 'yape';
const datosPago = { codigo: '123456' };

const resultadoPago = ESTRATEGIAS[metodoPago].procesar(pedidoEjemplo, datosPago);
console.log('Resultado del pago:', resultadoPago);

console.log('\n=== 4. Probando Observer ===');
const buscadorEventos = new ServicioNotificaciones();

// Suscribimos observadores
buscadorEventos.suscribir('pedidoCreado', (datos) => {
  console.log(`[Email enviado]: Nuevo pedido registrado #${datos.id}`);
});
buscadorEventos.suscribir('pedidoCreado', (datos) => {
  console.log(`[Log Bitácora]: Guardando pedido #${datos.id} en auditoría.`);
});

// Publicamos el evento
buscadorEventos.publicar('pedidoCreado', { id: 101, cliente: 'Carlos' });