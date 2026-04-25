const clientService = require('../services/clientService');
const { asyncHandler } = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const clients = await clientService.findAll();
  res.json(clients);
});

const get = asyncHandler(async (req, res) => {
  const client = await clientService.findById(req.params.id);
  res.json(client);
});

const create = asyncHandler(async (req, res) => {
  const client = await clientService.create(req.body);
  res.status(201).json(client);
});

const update = asyncHandler(async (req, res) => {
  const client = await clientService.update(req.params.id, req.body);
  res.json(client);
});

const remove = asyncHandler(async (req, res) => {
  await clientService.remove(req.params.id);
  res.status(204).send();
});

module.exports = { list, get, create, update, remove };
