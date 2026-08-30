package com.controlegastos.api.dto;

import java.util.List;

/** ids: IDs das categorias visíveis na ordem final desejada - ver CategoriaService.reordenar. */
public record ReordenarCategoriasRequestDTO(List<Integer> ids) {
}
