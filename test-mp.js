const { MercadoPagoConfig, Preference } = require('mercadopago');
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-4565921739184749-070909-41de2d0ec0bed9a23c1eb32e68f2f216-3468883347' });
const preference = new Preference(client);

async function test() {
  try {
    const result = await preference.create({
      body: {
        items: [
          {
            id: 'test-uuid-1234',
            title: 'Anticipo de Orden - Distrito Pipa',
            quantity: 1,
            unit_price: 50,
            currency_id: 'MXN'
          }
        ],
        back_urls: {
          success: 'https://www.distritopipa.com/checkout/success',
          failure: 'https://www.distritopipa.com/checkout/success',
          pending: 'https://www.distritopipa.com/checkout/success'
        },
        auto_return: 'approved',
        external_reference: 'test-uuid-1234',
      }
    });
    console.log(result.init_point);
  } catch (error) {
    console.error(error);
  }
}
test();
