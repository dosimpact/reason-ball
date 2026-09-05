import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import type { CreateTodoDto, Todo, UpdateTodoDto } from "./todo.model";
import { TodosService } from "./todos.service";

@Controller("todos")
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  findAll(): Todo[] {
    return this.todosService.findAll();
  }

  @Post()
  create(@Body() input: CreateTodoDto): Todo {
    return this.todosService.create(input);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() input: UpdateTodoDto,
  ): Todo {
    return this.todosService.update(id, input);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number): void {
    this.todosService.remove(id);
  }
}

