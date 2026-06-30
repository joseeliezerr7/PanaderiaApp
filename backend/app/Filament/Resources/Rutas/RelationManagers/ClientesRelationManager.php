<?php

namespace App\Filament\Resources\Rutas\RelationManagers;

use Filament\Actions\EditAction;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class ClientesRelationManager extends RelationManager
{
    protected static string $relationship = 'clientes';

    protected static ?string $title = 'Clientes de la ruta';

    protected static bool $isLazy = false;

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('nombre')
                    ->required(),
                TextInput::make('negocio'),
                TextInput::make('telefono')
                    ->label('Teléfono'),
                TextInput::make('orden_visita')
                    ->label('Orden de visita')
                    ->numeric(),
                Toggle::make('activo'),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->deferLoading(false)
            ->reorderable('orden_visita')
            ->defaultSort('orden_visita')
            ->paginated(false)
            ->columns([
                TextColumn::make('orden_visita')
                    ->label('#')
                    ->sortable(),
                TextColumn::make('nombre')
                    ->searchable(),
                TextColumn::make('negocio')
                    ->searchable(),
                TextColumn::make('diasVisita.dia_num')
                    ->label('Días de visita')
                    ->formatStateUsing(fn ($state) => \App\Models\ClienteDiaVisita::DIAS[$state] ?? $state)
                    ->badge(),
                IconColumn::make('activo')
                    ->boolean(),
            ])
            ->filters([
                TernaryFilter::make('activo')
                    ->default(true),
            ])
            ->recordActions([
                EditAction::make(),
            ]);
    }
}
