package com.controlegastos.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.time.ZoneId;
import java.util.TimeZone;

@SpringBootApplication
public class ControleGastosApiApplication {

	// A VM da Oracle Cloud roda em UTC; o app atende um único usuário, em horário de
	// Brasília. Sem fixar o fuso, todo LocalDate.now()/LocalDateTime.now() do servidor
	// vira o dia seguinte a partir das 21h local — e aí uma conta que vence hoje
	// aparecia como "Atrasada" (e sumia de "Vence hoje") na noite anterior ao
	// vencimento, porque atrasadas() compara vencimento_original < hoje. Fixar o fuso
	// aqui, antes de qualquer bean subir, deixa o "hoje" do servidor igual ao do
	// usuário. (Brasília não tem mais horário de verão desde 2019, mas o ZoneId cobre
	// a regra caso volte.)
	static final ZoneId FUSO_PADRAO = ZoneId.of("America/Sao_Paulo");

	public static void main(String[] args) {
		TimeZone.setDefault(TimeZone.getTimeZone(FUSO_PADRAO));
		SpringApplication.run(ControleGastosApiApplication.class, args);
	}

}
