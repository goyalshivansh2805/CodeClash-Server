.PHONY: dev prod down clean db-dev db-prod

dev:
	sudo docker compose -f docker-compose-development.yml up -d --build
	@echo "Development environment started in the background."
	sudo docker compose -f docker-compose-development.yml logs -f app

prod:
	sudo docker compose -f docker-compose.yml up -d --build
	@echo "Production environment started in the background."
	sudo docker compose -f docker-compose.yml logs -f app

dev-rs:
	sudo docker compose -f docker-compose-development.yml down
	@echo "Containers stopped."
	sudo docker compose -f docker-compose-development.yml up -d --build
	@echo "Development environment started in the background."
	sudo docker compose -f docker-compose-development.yml logs -f app

prod-rs:
	sudo docker compose -f docker-compose.yml down
	@echo "Containers stopped."
	sudo docker compose -f docker-compose.yml up -d --build
	@echo "Production environment started in the background."
	sudo docker compose -f docker-compose.yml logs -f app
	
down:
	sudo docker compose -f docker-compose-development.yml down
	sudo docker compose -f docker-compose.yml down
	@echo "Containers stopped."

clean:
	sudo docker compose -f docker-compose-development.yml down -v
	sudo docker compose -f docker-compose.yml down -v
	sudo docker system prune -f
	@echo "Cleanup complete."

db-dev:
	sudo docker compose -f docker-compose-development.yml exec db psql -U anish -d codeclash

db-prod:
	sudo docker compose -f docker-compose.yml exec db psql -U anish -d codeclash
